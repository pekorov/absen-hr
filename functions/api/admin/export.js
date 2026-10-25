import { json, rp, today, gate } from '../../_lib.js';
import { validMonth, monthDays, allEmployees } from '../../_payroll.js';

// One row per person per day for the Excel export (attendance sheet).
export async function onRequestGet({ request, env }) {
  const adm = await gate(request, env, 'pay'); if (adm instanceof Response) return adm;
  const ym = new URL(request.url).searchParams.get('month');
  if (!validMonth(ym)) return json({ error: 'Pick a month' }, 400);
  const days = monthDays(ym), emps = (await allEmployees(env)).sort((a, b) => a.name.localeCompare(b.name));
  const res = emps.length ? await rp(env, emps.map(e => ['MGET', ...days.map(d => `sched:${d}:${e.id}`), ...days.map(d => `att:${d}:${e.id}`), ...days.map(d => `leave:${d}:${e.id}`)])) : [];
  const n = days.length, rows = [], t = today();
  emps.forEach((e, k) => days.forEach((d, i) => {
    const code = res[k][i], a = res[k][n + i] ? JSON.parse(res[k][n + i]) : null, lv = !!res[k][2 * n + i];
    if (!code && !a && !lv) return;
    rows.push({ date: d, name: e.name, shift: code || '', in: a?.in || '', out: a?.out || '', outBy: a?.outBy || '', late: a?.late || 0, place: a?.place || '', status: lv ? 'annual leave' : a ? a.status : code && code !== 'OFF' ? (d < t ? 'absent' : 'scheduled') : '', flags: (a?.fl || []).join(' ') });
  }));
  return json({ month: ym, rows });
}
