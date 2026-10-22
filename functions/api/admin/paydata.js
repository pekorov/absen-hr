import { json, rp, slug, gate, audit } from '../../_lib.js';
import { PAY_TYPES } from '../../_payroll.js';

// body: { rows: [{ name, type: 'monthly' | 'hourly' | 'daily', rate, freq: 'weekly' | 'monthly' }] }  (rate in Rupiah)
export async function onRequestPost({ request, env }) {
  const adm = await gate(request, env, 'pay'); if (adm instanceof Response) return adm;
  const { rows } = await request.json();
  const ids = rows.map(r => slug(r.name));
  const old = (await rp(env, ids.map(i => ['GET', 'emp:' + i]))).map(v => (v ? JSON.parse(v) : null));
  const errors = [], cmds = [];
  rows.forEach((r, i) => {
    if (!old[i]) { errors.push(`${r.name}: not found. Import a schedule that includes this person first.`); return; }
    const rate = Math.round(Number(r.rate) || 0);
    if (!PAY_TYPES.includes(r.type)) { errors.push(`${r.name}: pay type must be Monthly, Daily or Hourly`); return; }
    if (rate <= 0) { errors.push(`${r.name}: rate is empty`); return; }
    cmds.push(['SET', 'emp:' + ids[i], JSON.stringify({ ...old[i], pay: { type: r.type, rate, freq: r.freq === 'weekly' ? 'weekly' : 'monthly' } })]);
  });
  if (errors.length) return json({ errors: errors.slice(0, 20) }, 400);
  await rp(env, cmds);
  await audit(env, adm, 'Imported salary data', `${rows.length} people`);
  return json({ ok: true, employees: rows.length });
}
