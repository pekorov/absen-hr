import { json, rp, jget, getOffices, slug, isAdmin, noAdmin } from '../../_lib.js';

// body: { rows: [{ name, pin, days: { "2026-10-19": "P", ... } }] }
export async function onRequestPost({ request, env }) {
  if (!isAdmin(request, env)) return noAdmin();
  const { rows } = await request.json();
  const shifts = await jget(env, 'shifts');
  if (!shifts) return json({ errors: ['Set up your shift codes first (Setup tab).'] }, 400);
  const offices = await getOffices(env);
  const ids = rows.map(r => slug(r.name));
  const old = (await rp(env, ids.map(i => ['GET', 'emp:' + i]))).map(v => (v ? JSON.parse(v) : null));
  const errors = [], cmds = [];
  let days = 0;
  rows.forEach((r, i) => {
    const id = ids[i], pin = String(r.pin || '').trim() || old[i]?.pin;
    if (!id) { errors.push(`Row ${i + 2}: name is empty`); return; }
    if (!/^\d{4}$/.test(pin || '')) errors.push(`${r.name}: PIN must be 4 digits`);
    for (const [d, c0] of Object.entries(r.days)) {
      let c = String(c0 || '').trim() || 'OFF';
      if (c.toUpperCase() === 'OFF') c = 'OFF';
      if (c !== 'OFF' && !shifts[c]) errors.push(`${r.name} on ${d}: unknown shift code "${c}"`);
      cmds.push(['SET', `sched:${d}:${id}`, c]);
      days++;
    }
    let loc = old[i]?.loc ?? null; // no Location column in the file = keep what is saved
    if (r.loc !== undefined) {
      const v = String(r.loc || '').trim();
      if (!v || ['all', 'semua'].includes(v.toLowerCase())) loc = null;
      else if (offices.some(o => o.id === slug(v))) loc = slug(v);
      else errors.push(`${r.name}: unknown location "${v}"`);
    }
    cmds.push(['SET', 'emp:' + id, JSON.stringify({ name: String(r.name).trim(), pin, loc })], ['SADD', 'emps', id]);
  });
  if (errors.length) return json({ errors: errors.slice(0, 20) }, 400);
  await rp(env, cmds);
  return json({ ok: true, employees: rows.length, days });
}
