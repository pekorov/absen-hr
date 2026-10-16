import { json, rp, slug, isAdmin, noAdmin } from '../../_lib.js';

// body: { rows: [{ name, type: 'monthly' | 'hourly', rate }] }  (rate in Rupiah)
export async function onRequestPost({ request, env }) {
  if (!isAdmin(request, env)) return noAdmin();
  const { rows } = await request.json();
  const ids = rows.map(r => slug(r.name));
  const old = (await rp(env, ids.map(i => ['GET', 'emp:' + i]))).map(v => (v ? JSON.parse(v) : null));
  const errors = [], cmds = [];
  rows.forEach((r, i) => {
    if (!old[i]) { errors.push(`${r.name}: not found. Import a schedule that includes this person first.`); return; }
    const rate = Math.round(Number(r.rate) || 0);
    if (!['monthly', 'hourly'].includes(r.type)) { errors.push(`${r.name}: pay type must be Monthly or Hourly`); return; }
    if (rate <= 0) { errors.push(`${r.name}: rate is empty`); return; }
    cmds.push(['SET', 'emp:' + ids[i], JSON.stringify({ ...old[i], pay: { type: r.type, rate } })]);
  });
  if (errors.length) return json({ errors: errors.slice(0, 20) }, 400);
  await rp(env, cmds);
  return json({ ok: true, employees: rows.length });
}
