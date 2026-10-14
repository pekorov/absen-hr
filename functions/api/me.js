import { json, rp, jget, auth, getOffices, today, addDays } from '../_lib.js';

export async function onRequestGet({ request, env }) {
  const u = await auth(request, env);
  if (!u) return json({ error: 'Wrong name or PIN' }, 401);
  const t = today(), days = [...Array(7)].map((_, i) => addDays(t, i));
  const [shifts, codes, rec, yest] = await Promise.all([
    jget(env, 'shifts'),
    rp(env, days.map(d => ['GET', `sched:${d}:${u.id}`])),
    jget(env, `att:${t}:${u.id}`),
    jget(env, `att:${addDays(t, -1)}:${u.id}`),
  ]);
  const open = (rec && !rec.out) || ((!rec || rec.out) && yest && !yest.out);
  const { ph, ...today_ } = rec || {};
  const offices = await getOffices(env), mine = u.loc && offices.find(o => o.id === u.loc);
  return json({
    name: u.name,
    place: u.loc ? (mine ? mine.name : 'Location not set') : 'Any location',
    week: days.map((d, i) => ({ date: d, code: codes[i], ...((shifts && shifts[codes[i]]) || {}) })),
    today: rec ? today_ : null,
    open: !!open,
  });
}
