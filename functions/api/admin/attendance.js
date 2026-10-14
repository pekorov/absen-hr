import { json, rp, r1, today, isAdmin, noAdmin } from '../../_lib.js';

export async function onRequestGet({ request, env }) {
  if (!isAdmin(request, env)) return noAdmin();
  const d = new URL(request.url).searchParams.get('date') || today();
  const ids = await r1(env, 'SMEMBERS', 'emps');
  if (!ids.length) return json({ date: d, rows: [] });
  const res = await rp(env, ids.flatMap(i => [['GET', 'emp:' + i], ['GET', `sched:${d}:${i}`], ['GET', `att:${d}:${i}`]]));
  const rows = ids.map((id, i) => {
    const e = JSON.parse(res[3 * i] || '{}'), a = JSON.parse(res[3 * i + 2] || 'null');
    return { name: e.name || id, code: res[3 * i + 1] || '', ...(a ? { in: a.in, out: a.out, late: a.late, status: a.status, fl: a.fl, ph: a.ph } : {}) };
  }).sort((x, y) => x.name.localeCompare(y.name));
  return json({ date: d, rows });
}
