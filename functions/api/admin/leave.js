import { json, rp, r1, addDays, gate, audit } from '../../_lib.js';
import { validMonth, monthDays, allEmployees } from '../../_payroll.js';

// Paid annual leave. The day keeps its scheduled shift but is paid as normal (no absence deduction).
export async function onRequestGet({ request, env }) {
  const adm = await gate(request, env, 'ops'); if (adm instanceof Response) return adm;
  const ym = new URL(request.url).searchParams.get('month');
  if (!validMonth(ym)) return json({ error: 'Pick a month' }, 400);
  const days = monthDays(ym), emps = await allEmployees(env);
  const res = emps.length ? await rp(env, emps.map(e => ['MGET', ...days.map(d => `leave:${d}:${e.id}`)])) : [];
  return json({ list: emps.map((e, i) => ({ id: e.id, name: e.name, days: days.filter((d, k) => res[i][k]) })).sort((a, b) => a.name.localeCompare(b.name)) });
}

export async function onRequestPost({ request, env }) {
  const adm = await gate(request, env, 'ops'); if (adm instanceof Response) return adm;
  const b = await request.json();
  if (!(await r1(env, 'GET', 'emp:' + b.id))) return json({ error: 'Employee not found' }, 400);
  if (b.action === 'remove') { await r1(env, 'DEL', `leave:${b.date}:${b.id}`); await audit(env, adm, 'Removed leave', `${b.id} · ${b.date}`); return json({ ok: true }); }
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (b.action !== 'add' || !re.test(b.from) || !re.test(b.to) || b.to < b.from) return json({ error: 'Pick a valid From and To date' }, 400);
  const dates = [];
  for (let d = b.from; d <= b.to && dates.length < 63; d = addDays(d, 1)) dates.push(d);
  if (dates.length > 62) return json({ error: 'Leave can be at most 62 days at a time' }, 400);
  const sched = await rp(env, dates.map(d => ['GET', `sched:${d}:${b.id}`]));
  await rp(env, dates.map(d => ['SET', `leave:${d}:${b.id}`, '1']));
  await audit(env, adm, 'Added leave', `${b.id} · ${b.from} to ${b.to}`);
  return json({ ok: true, days: dates.length, shifts: sched.filter(c => c && c !== 'OFF').length });
}
