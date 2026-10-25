import { say } from '../_msg.js';
import { json, rp, jget, auth, getOffices, locsOf, stillOpenFromYesterday, autoOut, nowMin, today, addDays, undoUntil } from '../_lib.js';

export async function onRequestGet({ request, env }) {
  const u = await auth(request, env);
  if (!u) return json({ error: say(request, 'Wrong name or PIN') }, 401);
  const t = today(), days = [...Array(7)].map((_, i) => addDays(t, i));
  let [shifts, codes, rec, yest] = await Promise.all([
    jget(env, 'shifts'),
    rp(env, [...days.map(d => ['GET', `sched:${d}:${u.id}`]), ...days.map(d => ['GET', `leave:${d}:${u.id}`])]),
    jget(env, `att:${t}:${u.id}`),
    jget(env, `att:${addDays(t, -1)}:${u.id}`),
  ]);
  const nm = nowMin(), sweep = [];
  const r2 = autoOut(rec, t, shifts, t, nm), y2 = autoOut(yest, addDays(t, -1), shifts, t, nm);
  if (r2) { rec = r2; sweep.push(['SET', `att:${t}:${u.id}`, JSON.stringify(r2)]); }
  if (y2) { yest = y2; sweep.push(['SET', `att:${addDays(t, -1)}:${u.id}`, JSON.stringify(y2)]); }
  if (sweep.length) await rp(env, sweep);
  const open = (rec && !rec.out) || ((!rec || rec.out) && stillOpenFromYesterday(yest, shifts, nm));
  const { ph, ...today_ } = rec || {};
  const offices = await getOffices(env), names = offices.filter(o => locsOf(u.loc).includes(o.id)).map(o => o.name);
  return json({
    name: u.login || u.name,
    place: locsOf(u.loc).length ? (names.join(' / ') || say(request, 'Location not set')) : say(request, 'Any location'),
    week: days.map((d, i) => ({ date: d, code: codes[i], leave: !!codes[7 + i], ...((shifts && shifts[codes[i]]) || {}) })),
    today: rec ? today_ : null,
    open: !!open,
    undo: open ? 0 : undoUntil(rec || yest), // a recent clock-out can still be undone until this time
  });
}
