import { json, rp, r1, jget, auth, geoWhy, today, addDays, nowMin, stamp, hm } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  const u = await auth(request, env);
  if (!u) return json({ error: 'Wrong name or PIN' }, 401);
  const b = await request.json().catch(() => ({}));
  if (typeof b.lat !== 'number' || typeof b.lng !== 'number') return json({ error: 'Location not detected. Turn on location and try again.' }, 400);
  const t = today(), nm = nowMin(), why = await geoWhy(env, u, b, b.type === 'in');
  const photo = why.includes('no_selfie') ? null : b.photo;

  if (b.type === 'in') {
    if (await jget(env, `att:${t}:${u.id}`)) return json({ error: 'You already clocked in today.' }, 400);
    const code = await r1(env, 'GET', `sched:${t}:${u.id}`), shifts = await jget(env, 'shifts');
    const sh = code && code !== 'OFF' && shifts ? shifts[code] : null;
    if (!sh) why.push('no_shift_today');
    const late = sh ? Math.max(0, nm - hm(sh.start)) : 0;
    const rec = { in: stamp(nm), code: code || null, late, fl: why, ph: photo, status: why.length ? 'review' : 'ok' };
    const cmds = [['SET', `att:${t}:${u.id}`, JSON.stringify(rec)]];
    if (why.length) cmds.push(['SADD', 'review', `${t}|${u.id}`]);
    await rp(env, cmds);
    return json({ ok: true, status: rec.status, reasons: why, late });
  }

  // Clock out: today's open record, or yesterday's (night shifts that cross midnight).
  let d = t, rec = await jget(env, `att:${d}:${u.id}`);
  if (!rec || rec.out) { d = addDays(t, -1); rec = await jget(env, `att:${d}:${u.id}`); }
  if (!rec || rec.out) return json({ error: 'No open clock-in found.' }, 400);
  rec.out = stamp(nm);
  rec.fl = [...new Set([...rec.fl, ...why])];
  if (why.length && rec.status === 'ok') rec.status = 'review';
  const cmds = [['SET', `att:${d}:${u.id}`, JSON.stringify(rec)]];
  if (rec.status === 'review') cmds.push(['SADD', 'review', `${d}|${u.id}`]);
  await rp(env, cmds);
  return json({ ok: true, status: rec.status, reasons: why });
}
