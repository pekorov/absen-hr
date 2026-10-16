import { json, rp, r1, isAdmin, noAdmin } from '../../_lib.js';

export async function onRequestGet({ request, env }) {
  if (!isAdmin(request, env)) return noAdmin();
  const keys = await r1(env, 'SMEMBERS', 'review');
  if (!keys.length) return json([]);
  const res = await rp(env, keys.flatMap(k => { const [d, id] = k.split('|'); return [['GET', `att:${d}:${id}`], ['GET', 'emp:' + id], ['GET', `ph:${d}:${id}`]]; }));
  return json(keys.map((k, i) => {
    const a = JSON.parse(res[3 * i] || 'null'), e = JSON.parse(res[3 * i + 1] || 'null');
    return a && { key: k, date: k.split('|')[0], name: e?.name || k, ...a, ph: res[3 * i + 2] || a.ph };
  }).filter(Boolean));
}

export async function onRequestPost({ request, env }) {
  if (!isAdmin(request, env)) return noAdmin();
  const { key, decision, out } = await request.json();
  if (!['approved', 'rejected'].includes(decision)) return json({ error: 'Bad decision' }, 400);
  const [d, id] = String(key).split('|');
  const raw = await r1(env, 'GET', `att:${d}:${id}`);
  if (raw) {
    const a = JSON.parse(raw);
    a.status = decision;
    if (decision === 'approved' && /^\d{1,2}:\d{2}$/.test(out || '')) { a.out = out.padStart(5, '0'); a.outBy = 'hr'; a.fl = (a.fl || []).filter(f => f !== 'no_clock_out'); }
    await rp(env, [['SET', `att:${d}:${id}`, JSON.stringify(a)], ['SREM', 'review', key]]);
  } else await r1(env, 'SREM', 'review', key);
  return json({ ok: true });
}
