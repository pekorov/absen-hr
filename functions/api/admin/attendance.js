import { json, rp, r1, jget, hm, autoOut, nowMin, addDays, today, isAdmin, noAdmin } from '../../_lib.js';

export async function onRequestGet({ request, env }) {
  if (!isAdmin(request, env)) return noAdmin();
  const d = new URL(request.url).searchParams.get('date') || today();
  const ids = await r1(env, 'SMEMBERS', 'emps');
  if (!ids.length) return json({ date: d, today: today(), rows: [] });
  const shifts = await jget(env, 'shifts');
  // Close shifts that were never clocked out (3 hours after the shift end) before showing the day.
  const dates = [d, addDays(d, -1)], td = today(), nm = nowMin();
  const recs = await rp(env, dates.flatMap(dt => ids.map(i => ['GET', `att:${dt}:${i}`])));
  const fix = [];
  recs.forEach((v, k) => {
    if (!v) return;
    const dt = dates[Math.floor(k / ids.length)], id = ids[k % ids.length], up = autoOut(JSON.parse(v), dt, shifts, td, nm);
    if (up) fix.push(['SET', `att:${dt}:${id}`, JSON.stringify(up)]);
  });
  if (fix.length) await rp(env, fix);
  const res = await rp(env, ids.flatMap(i => [['GET', 'emp:' + i], ['GET', `sched:${d}:${i}`], ['GET', `att:${d}:${i}`], ['GET', `ph:${d}:${i}`]]));
  const rows = ids.map((id, i) => {
    const e = JSON.parse(res[4 * i] || '{}'), a = JSON.parse(res[4 * i + 2] || 'null'), code = res[4 * i + 1] || '';
    const end = shifts && shifts[code] && shifts[code].end;
    // Minutes between the shift end and clock-out. Only a hint for HR; it never changes pay.
    let over = 0;
    if (a && a.out && end) { const m = (hm(a.out) - hm(end) + 1440) % 1440; if (m > 0 && m < 360) over = m; }
    return { id, name: e.name || id, code, ...(a ? { in: a.in, out: a.out, auto: a.outBy === 'auto', late: a.late, over, status: a.status, fl: a.fl, place: a.place, ph: res[4 * i + 3] || a.ph } : {}) };
  }).sort((x, y) => x.name.localeCompare(y.name));
  return json({ date: d, today: td, rows });
}

// HR sets or corrects a clock-out time.
export async function onRequestPost({ request, env }) {
  if (!isAdmin(request, env)) return noAdmin();
  const { date, id, out } = await request.json();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !/^\d{1,2}:\d{2}$/.test(out || '')) return json({ error: 'Use a time like 16:00' }, 400);
  const raw = await r1(env, 'GET', `att:${date}:${id}`);
  if (!raw) return json({ error: 'No clock-in found for that person on that day' }, 400);
  const a = JSON.parse(raw);
  a.out = out.padStart(5, '0'); a.outBy = 'hr';
  a.fl = (a.fl || []).filter(f => f !== 'auto_clock_out' && f !== 'no_clock_out');
  await r1(env, 'SET', `att:${date}:${id}`, JSON.stringify(a));
  return json({ ok: true });
}
