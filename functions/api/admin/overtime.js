import { json, rp, jget, jset, isAdmin, noAdmin } from '../../_lib.js';
import { validMonth, allEmployees, otRule, otAmount } from '../../_payroll.js';

// Overtime is entered by HR. Nothing here is automatic. Pay = hours x the overtime rate per hour.
export async function onRequestGet({ request, env }) {
  if (!isAdmin(request, env)) return noAdmin();
  const ym = new URL(request.url).searchParams.get('month');
  if (!validMonth(ym)) return json({ error: 'Pick a month' }, 400);
  const [emps, settings] = await Promise.all([allEmployees(env), jget(env, 'paysettings')]);
  const raws = emps.length ? await rp(env, emps.map(e => ['GET', `ot:${ym}:${e.id}`])) : [];
  const rule = otRule(settings || {});
  const list = emps.map((e, i) => ({
    id: e.id, name: e.name,
    entries: (raws[i] ? JSON.parse(raws[i]) : []).map(x => ({ ...x, amount: otAmount(x, rule) })),
  })).sort((a, b) => a.name.localeCompare(b.name));
  return json({ rule, list });
}

export async function onRequestPost({ request, env }) {
  if (!isAdmin(request, env)) return noAdmin();
  const b = await request.json();
  if (b.action === 'delete') {
    if (!validMonth(b.month)) return json({ error: 'Bad month' }, 400);
    const key = `ot:${b.month}:${b.id}`;
    await jset(env, key, ((await jget(env, key)) || []).filter(e => e.uid !== b.uid));
    return json({ ok: true });
  }
  if (b.action !== 'add') return json({ error: 'Bad request' }, 400);
  const date = String(b.date || ''), ym = date.slice(0, 7);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !validMonth(ym)) return json({ error: 'Pick a valid date' }, 400);
  const hours = Math.round(Number(b.hours) * 100) / 100;
  if (!(hours > 0 && hours <= 24)) return json({ error: 'Hours must be between 0 and 24' }, 400);
  if (!(await jget(env, 'emp:' + b.id))) return json({ error: 'Employee not found' }, 400);
  const key = `ot:${ym}:${b.id}`, list = (await jget(env, key)) || [];
  if (list.length >= 60) return json({ error: 'Too many overtime entries for this person this month' }, 400);
  list.push({ uid: crypto.randomUUID().slice(0, 8), date, hours, note: String(b.note || '').slice(0, 80) });
  await jset(env, key, list);
  return json({ ok: true });
}
