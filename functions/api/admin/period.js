import { json, rp, jget, today, isAdmin, noAdmin } from '../../_lib.js';
import { allEmployees, loadPeriod, rangeDays, normPay, WA_DEFAULT, greetName } from '../../_payroll.js';

const re = /^\d{4}-\d{2}-\d{2}$/;
const problem = (from, to) => {
  if (!re.test(from || '') || !re.test(to || '') || to < from) return 'Pick a valid From and To date.';
  if (to > today()) return 'The end date cannot be in the future.';
  if (rangeDays(from, to).length > 62) return 'A period can be at most 62 days.';
  return null;
};

// Payslips for a date range (weekly pay, or the month so far). Staff see them as soon as HR creates them.
export async function onRequestGet({ request, env }) {
  if (!isAdmin(request, env)) return noAdmin();
  const q = new URL(request.url).searchParams, from = q.get('from'), to = q.get('to'), err = problem(from, to);
  if (err) return json({ error: err }, 400);
  const emps = await allEmployees(env), out = await loadPeriod(env, from, to, emps);
  const exist = emps.length ? await rp(env, emps.map(e => ['GET', `pslip:${from}_${to}:${e.id}`])) : [];
  const rows = out.map(({ emp, slip }, i) => ({ id: emp.id, name: emp.name, freq: normPay(emp.pay)?.freq || 'monthly', phone: emp.phone || '', greet: greetName(emp), created: !!exist[i], ...(slip.skip ? { skip: slip.skip } : slip) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const st = (await jget(env, 'paysettings')) || {};
  return json({ from, to, wa: st.waTemplate || WA_DEFAULT, rows });
}

export async function onRequestPost({ request, env }) {
  if (!isAdmin(request, env)) return noAdmin();
  const b = await request.json(), err = problem(b.from, b.to);
  if (err) return json({ error: err }, 400);
  const ids = new Set(Array.isArray(b.ids) ? b.ids : []);
  const emps = (await allEmployees(env)).filter(e => ids.has(e.id));
  if (!emps.length) return json({ error: 'Pick at least one person.' }, 400);
  const tag = `${b.from}_${b.to}`;
  if (b.action === 'remove') {
    await rp(env, emps.flatMap(e => [['DEL', `pslip:${tag}:${e.id}`], ['SREM', `pslips:${e.id}`, tag]]));
    return json({ ok: true, removed: emps.length });
  }
  if (b.action !== 'create') return json({ error: 'Bad request' }, 400);
  const out = await loadPeriod(env, b.from, b.to, emps), at = new Date().toISOString(), cmds = [], skipped = [];
  for (const { emp, slip } of out) {
    if (slip.skip) { skipped.push({ name: emp.name, why: slip.skip }); continue; }
    cmds.push(['SET', `pslip:${tag}:${emp.id}`, JSON.stringify({ ...slip, id: emp.id, at })], ['SADD', `pslips:${emp.id}`, tag]);
  }
  if (cmds.length) await rp(env, cmds);
  return json({ ok: true, created: cmds.length / 2, skipped });
}
