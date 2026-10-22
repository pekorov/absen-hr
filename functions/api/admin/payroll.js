import { json, rp, r1, jget, jset, gate, audit } from '../../_lib.js';
import { validMonth, monthEnded, loadMonth, allEmployees, lateRule, maxHours, waTemplate, shareCmds, greetName, slipFp } from '../../_payroll.js';

// Monthly payslips. Every payslip is a draft until an admin verifies it. Only verified payslips can be
// downloaded as PDF or sent on WhatsApp. If the numbers change after verifying, it needs verifying again.
const pendingFor = (review, id, inRange) => review.filter(k => { const [d, i] = k.split('|'); return i === id && inRange(d); }).length;

export async function onRequestGet({ request, env }) {
  const adm = await gate(request, env, 'pay'); if (adm instanceof Response) return adm;
  const ym = new URL(request.url).searchParams.get('month');
  if (!validMonth(ym)) return json({ error: 'Pick a month' }, 400);
  const [out, settings, review] = await Promise.all([allEmployees(env).then(e => loadMonth(env, ym, e)), jget(env, 'paysettings'), r1(env, 'SMEMBERS', 'review')]);
  const saved = out.length ? await rp(env, out.map(({ emp }) => ['GET', `slip:${ym}:${emp.id}`])) : [];
  const rows = out.map(({ emp, slip }, i) => {
    if (slip.skip) return { id: emp.id, name: emp.name, skip: slip.skip };
    const sv = saved[i] ? JSON.parse(saved[i]) : null;
    const state = sv && sv.ver ? (slipFp(sv) === slipFp(slip) ? 'verified' : 'changed') : 'draft';
    return { ...slip, id: emp.id, phone: emp.phone || '', greet: greetName(emp), state, ver: sv && sv.ver, share: state === 'verified' ? sv.share : undefined, shareUntil: state === 'verified' ? sv.shareUntil : undefined, pend: pendingFor(review, emp.id, d => d.startsWith(ym)) };
  }).sort((a, b) => a.name.localeCompare(b.name));
  return json({ month: ym, wa: waTemplate(settings), rawWa: (settings || {}).waTemplate || '', ended: monthEnded(ym), settings: { ...lateRule(settings || {}), maxHours: maxHours(settings || {}) }, pending: review.filter(k => k.startsWith(ym)).length, rows });
}

export async function onRequestPost({ request, env }) {
  const adm = await gate(request, env, 'pay'); if (adm instanceof Response) return adm;
  const b = await request.json();
  if (b.action === 'settings') {
    const cur = (await jget(env, 'paysettings')) || {}, next = { ...cur };
    if (b.lateOn !== undefined) next.lateOn = !!b.lateOn;
    if (b.maxHours !== undefined) { const m = Number(b.maxHours); if (!(m >= 1 && m <= 24)) return json({ error: 'Max paid hours must be between 1 and 24' }, 400); next.maxHours = Math.round(m * 2) / 2; }
    for (const k of ['tolerance', 'a1', 'from2', 'a2', 'from3', 'a3', 'otRate']) if (b[k] !== undefined) next[k] = Math.max(0, Math.round(Number(b[k]) || 0));
    if (typeof b.waTemplate === 'string') next.waTemplate = b.waTemplate.trim().slice(0, 500);
    await jset(env, 'paysettings', next);
    await audit(env, adm, 'Changed pay settings', Object.keys(b).filter(k => k !== 'action').join(', '));
    return json({ ok: true });
  }
  if (!['verify', 'unverify'].includes(b.action) || !validMonth(b.month)) return json({ error: 'Bad request' }, 400);
  const ids = new Set(Array.isArray(b.ids) ? b.ids : []);
  const emps = (await allEmployees(env)).filter(e => ids.has(e.id));
  if (!emps.length) return json({ error: 'Tick at least one person.' }, 400);
  const oldRaw = await rp(env, emps.map(e => ['GET', `slip:${b.month}:${e.id}`])), old = Object.fromEntries(emps.map((e, i) => [e.id, oldRaw[i] ? JSON.parse(oldRaw[i]) : null]));
  if (b.action === 'unverify') {
    await rp(env, [...emps.map(e => ['DEL', `slip:${b.month}:${e.id}`]), ...emps.filter(e => old[e.id] && old[e.id].share).map(e => ['DEL', 'share:' + old[e.id].share])]);
    await audit(env, adm, 'Un-verified payslips', `${b.month} · ${emps.map(e => e.name).join(', ')}`);
    return json({ ok: true, count: emps.length });
  }
  if (!monthEnded(b.month)) return json({ error: 'This month has not finished yet. For pay up to today, use Period payslips.' }, 400);
  const [out, review] = await Promise.all([loadMonth(env, b.month, emps), r1(env, 'SMEMBERS', 'review')]);
  const at = new Date().toISOString(), cmds = [], skipped = [];
  let count = 0;
  for (const { emp, slip } of out) {
    if (slip.skip) { skipped.push(`${emp.name}: no payslip`); continue; }
    if (pendingFor(review, emp.id, d => d.startsWith(b.month))) { skipped.push(`${emp.name}: clock-ins still in Review`); continue; }
    const key = `slip:${b.month}:${emp.id}`, sh = shareCmds(key, slip, old[emp.id]);
    cmds.push(['SET', key, JSON.stringify({ ...slip, id: emp.id, at, ver: { by: adm.name, at }, ...sh.extra })], ...sh.cmds);
    count++;
  }
  if (cmds.length) {
    await rp(env, cmds);
    await audit(env, adm, 'Verified payslips', `${b.month} · ${count} people`);
  }
  return json({ ok: true, count, skipped });
}
