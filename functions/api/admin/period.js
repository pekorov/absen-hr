import { json, rp, r1, jget, today, gate, audit } from '../../_lib.js';
import { allEmployees, loadPeriod, rangeDays, normPay, waTemplate, shareCmds, greetName, slipFp } from '../../_payroll.js';

const re = /^\d{4}-\d{2}-\d{2}$/;
const problem = (from, to) => {
  if (!re.test(from || '') || !re.test(to || '') || to < from) return 'Pick a valid From and To date.';
  if (to > today()) return 'The end date cannot be in the future.';
  if (rangeDays(from, to).length > 62) return 'A period can be at most 62 days.';
  return null;
};
const pendingFor = (review, id, from, to) => review.filter(k => { const [d, i] = k.split('|'); return i === id && d >= from && d <= to; }).length;

// Payslips for a date range (weekly pay, or the month so far). Draft until an admin verifies them.
export async function onRequestGet({ request, env }) {
  const adm = await gate(request, env, 'pay'); if (adm instanceof Response) return adm;
  const q = new URL(request.url).searchParams, from = q.get('from'), to = q.get('to'), err = problem(from, to);
  if (err) return json({ error: err }, 400);
  const emps = await allEmployees(env);
  const [out, review] = await Promise.all([loadPeriod(env, from, to, emps), r1(env, 'SMEMBERS', 'review')]);
  const saved = emps.length ? await rp(env, emps.map(e => ['GET', `pslip:${from}_${to}:${e.id}`])) : [];
  const rows = out.map(({ emp, slip }, i) => {
    const base = { id: emp.id, name: emp.name, freq: normPay(emp.pay)?.freq || 'monthly', phone: emp.phone || '', greet: greetName(emp) };
    if (slip.skip) return { ...base, skip: slip.skip };
    const sv = saved[i] ? JSON.parse(saved[i]) : null;
    const state = sv && sv.ver ? (slipFp(sv) === slipFp(slip) ? 'verified' : 'changed') : 'draft';
    return { ...base, ...slip, state, ver: sv && sv.ver, share: state === 'verified' ? sv.share : undefined, shareUntil: state === 'verified' ? sv.shareUntil : undefined, pend: pendingFor(review, emp.id, from, to) };
  }).sort((a, b) => a.name.localeCompare(b.name));
  const st = (await jget(env, 'paysettings')) || {};
  return json({ from, to, wa: waTemplate(st), rows });
}

export async function onRequestPost({ request, env }) {
  const adm = await gate(request, env, 'pay'); if (adm instanceof Response) return adm;
  const b = await request.json(), err = problem(b.from, b.to);
  if (err) return json({ error: err }, 400);
  const ids = new Set(Array.isArray(b.ids) ? b.ids : []);
  const emps = (await allEmployees(env)).filter(e => ids.has(e.id));
  if (!emps.length) return json({ error: 'Tick at least one person.' }, 400);
  const tag = `${b.from}_${b.to}`;
  const oldRaw = await rp(env, emps.map(e => ['GET', `pslip:${tag}:${e.id}`])), old = Object.fromEntries(emps.map((e, i) => [e.id, oldRaw[i] ? JSON.parse(oldRaw[i]) : null]));
  if (b.action === 'unverify') {
    await rp(env, [...emps.flatMap(e => [['DEL', `pslip:${tag}:${e.id}`], ['SREM', `pslips:${e.id}`, tag]]), ...emps.filter(e => old[e.id] && old[e.id].share).map(e => ['DEL', 'share:' + old[e.id].share])]);
    await audit(env, adm, 'Un-verified payslips', `${b.from} to ${b.to} · ${emps.map(e => e.name).join(', ')}`);
    return json({ ok: true, count: emps.length });
  }
  if (b.action !== 'verify') return json({ error: 'Bad request' }, 400);
  const [out, review] = await Promise.all([loadPeriod(env, b.from, b.to, emps), r1(env, 'SMEMBERS', 'review')]);
  const at = new Date().toISOString(), cmds = [], skipped = [];
  let count = 0;
  for (const { emp, slip } of out) {
    if (slip.skip) { skipped.push(`${emp.name}: no payslip`); continue; }
    if (pendingFor(review, emp.id, b.from, b.to)) { skipped.push(`${emp.name}: clock-ins still in Review`); continue; }
    const key = `pslip:${tag}:${emp.id}`, sh = shareCmds(key, slip, old[emp.id]);
    cmds.push(['SET', key, JSON.stringify({ ...slip, id: emp.id, at, ver: { by: adm.name, at }, ...sh.extra })], ['SADD', `pslips:${emp.id}`, tag], ...sh.cmds);
    count++;
  }
  if (cmds.length) {
    await rp(env, cmds);
    await audit(env, adm, 'Verified payslips', `${b.from} to ${b.to} · ${count} people`);
  }
  return json({ ok: true, count, skipped });
}
