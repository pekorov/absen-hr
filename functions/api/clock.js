import { json, rp, r1, jget, auth, geoWhy, placeCheck, stillOpenFromYesterday, autoOut, today, addDays, nowMin, stamp, hm } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  const u = await auth(request, env);
  if (!u) return json({ error: 'Wrong name or PIN' }, 401);
  const b = await request.json().catch(() => ({}));
  if (typeof b.lat !== 'number' || typeof b.lng !== 'number') return json({ error: 'Location not detected. Turn on location and try again.' }, 400);
  const chk = await placeCheck(env, u, b.lat, b.lng, b.accuracy, b.type, b.qr);
  if (chk.blocked) return json({ error: chk.blocked }, 400);
  const t = today(), nm = nowMin(), why = await geoWhy(env, u, b, b.type === 'in', chk);
  const photo = why.includes('no_selfie') ? null : b.photo;

  if (b.type === 'in') {
    if (await jget(env, `att:${t}:${u.id}`)) return json({ error: 'You already clocked in today.' }, 400);
    const code = await r1(env, 'GET', `sched:${t}:${u.id}`), shifts = await jget(env, 'shifts');
    const sh = code && code !== 'OFF' && shifts ? shifts[code] : null;
    if (!sh) why.push('no_shift_today');
    const late = sh ? Math.max(0, nm - hm(sh.start)) : 0;
    const rec = { in: stamp(nm), code: code || null, late, fl: why, hasPh: !!photo, place: chk.place, status: why.length ? 'review' : 'ok' };
    const cmds = [['SET', `att:${t}:${u.id}`, JSON.stringify(rec)]];
    if (photo) cmds.push(['SET', `ph:${t}:${u.id}`, photo, 'EX', 5184000]); // kept 60 days
    // Profile photo = the person's first selfie, kept permanently. For people who started before this
    // feature, the oldest selfie still stored (60 days) is used instead of today's.
    if (photo && !(await r1(env, 'EXISTS', 'ref:' + u.id))) {
      const dates = Array.from({ length: 60 }, (_, i) => addDays(t, i - 60));
      const old = (await r1(env, 'MGET', ...dates.map(d => `ph:${d}:${u.id}`))).find(Boolean);
      cmds.push(['SET', 'ref:' + u.id, old || photo, 'NX']);
    }
    if (why.length) cmds.push(['SADD', 'review', `${t}|${u.id}`]);
    // Yesterday still has no clock-out (and it is not a night shift): flag it for HR.
    const yd = addDays(t, -1), y = await jget(env, `att:${yd}:${u.id}`);
    if (y && !y.out && !stillOpenFromYesterday(y, shifts, nm)) {
      const au = autoOut(y, yd, shifts, t, nm); // close it at the scheduled end
      if (au) cmds.push(['SET', `att:${yd}:${u.id}`, JSON.stringify(au)]);
      else if (!(y.fl || []).includes('no_clock_out')) { // no shift on record, so HR must set the time
        y.fl = [...(y.fl || []), 'no_clock_out'];
        if (y.status === 'ok') y.status = 'review';
        cmds.push(['SET', `att:${yd}:${u.id}`, JSON.stringify(y)], ['SADD', 'review', `${yd}|${u.id}`]);
      }
    }
    await rp(env, cmds);
    return json({ ok: true, status: rec.status, reasons: why, late });
  }

  // Clock out: today's open record, or yesterday's (night shifts that cross midnight).
  const shifts = await jget(env, 'shifts');
  let d = t, rec = await jget(env, `att:${d}:${u.id}`);
  if (!rec || rec.out) { d = addDays(t, -1); rec = await jget(env, `att:${d}:${u.id}`); if (!stillOpenFromYesterday(rec, shifts, nm)) rec = null; }
  if (!rec || rec.out) return json({ error: 'No open clock-in found.' }, 400);
  const au = autoOut(rec, d, shifts, t, nm);
  if (au) { await r1(env, 'SET', `att:${d}:${u.id}`, JSON.stringify(au)); return json({ error: `Your shift was closed automatically at ${au.out}. Ask HR if this is not correct.` }, 400); }
  rec.out = stamp(nm);
  rec.fl = [...new Set([...rec.fl, ...why])];
  if (why.length && rec.status === 'ok') rec.status = 'review';
  const cmds = [['SET', `att:${d}:${u.id}`, JSON.stringify(rec)]];
  if (rec.status === 'review') cmds.push(['SADD', 'review', `${d}|${u.id}`]);
  await rp(env, cmds);
  return json({ ok: true, status: rec.status, reasons: why });
}
