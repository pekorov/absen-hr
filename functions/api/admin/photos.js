import { json, rp, today, addDays, gate } from '../../_lib.js';

// One employee's photos: the first photo (kept) and every clock-in selfie still stored (last 60 days).
export async function onRequestGet({ request, env }) {
  const adm = await gate(request, env, 'ops'); if (adm instanceof Response) return adm;
  const id = new URL(request.url).searchParams.get('id') || '';
  const t = today(), dates = Array.from({ length: 61 }, (_, i) => addDays(t, -i)); // newest first
  const [emp, ref, phs, atts] = await rp(env, [['GET', 'emp:' + id], ['GET', 'ref:' + id], ['MGET', ...dates.map(d => `ph:${d}:${id}`)], ['MGET', ...dates.map(d => `att:${d}:${id}`)]]);
  if (!emp) return json({ error: 'Employee not found' }, 404);
  const list = dates.map((d, i) => {
    if (!phs[i]) return null;
    const a = atts[i] ? JSON.parse(atts[i]) : {};
    return { date: d, ph: phs[i], in: a.in || '', place: a.place || '', status: a.status || '', fl: a.fl || [] };
  }).filter(Boolean);
  return json({ name: JSON.parse(emp).name, ref, list });
}
