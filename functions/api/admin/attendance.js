import { json, rp, r1, jget, hm, today, isAdmin, noAdmin } from '../../_lib.js';

export async function onRequestGet({ request, env }) {
  if (!isAdmin(request, env)) return noAdmin();
  const d = new URL(request.url).searchParams.get('date') || today();
  const ids = await r1(env, 'SMEMBERS', 'emps');
  if (!ids.length) return json({ date: d, rows: [] });
  const [res, shifts] = await Promise.all([
    rp(env, ids.flatMap(i => [['GET', 'emp:' + i], ['GET', `sched:${d}:${i}`], ['GET', `att:${d}:${i}`], ['GET', `ph:${d}:${i}`]])),
    jget(env, 'shifts')]);
  const rows = ids.map((id, i) => {
    const e = JSON.parse(res[4 * i] || '{}'), a = JSON.parse(res[4 * i + 2] || 'null'), code = res[4 * i + 1] || '';
    const end = shifts && shifts[code] && shifts[code].end;
    // Minutes between the shift end and clock-out. Only a hint for HR; it never changes pay.
    let over = 0;
    if (a && a.out && end) { const m = (hm(a.out) - hm(end) + 1440) % 1440; if (m > 0 && m < 360) over = m; }
    return { name: e.name || id, code, ...(a ? { in: a.in, out: a.out, late: a.late, over, status: a.status, fl: a.fl, place: a.place, ph: res[4 * i + 3] || a.ph } : {}) };
  }).sort((x, y) => x.name.localeCompare(y.name));
  return json({ date: d, rows });
}
