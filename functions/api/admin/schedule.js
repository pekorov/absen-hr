import { json, rp, jget, getOffices, slug, normPhone, splitLoc, isAdmin, noAdmin } from '../../_lib.js';

// body: { rows: [{ name, pin, days: { "2026-10-19": "P", ... } }] }
export async function onRequestPost({ request, env }) {
  if (!isAdmin(request, env)) return noAdmin();
  const { rows } = await request.json();
  const shifts = await jget(env, 'shifts');
  if (!shifts) return json({ errors: ['Set up your shift codes first (Setup tab).'] }, 400);
  const offices = await getOffices(env);
  const keyOf = s => String(s).trim().replace(/\s+/g, ' ').toLowerCase();
  const byKey = Object.fromEntries(Object.keys(shifts).map(k => [keyOf(k), k]));
  const ids = rows.map(r => slug(r.name));
  const old = (await rp(env, ids.map(i => ['GET', 'emp:' + i]))).map(v => (v ? JSON.parse(v) : null));
  const wantLogin = rows.map(r => (r.login === undefined ? undefined : slug(r.login || '')));
  const keys = [...new Set(wantLogin.filter(Boolean))];
  const owners = keys.length ? await rp(env, keys.flatMap(k => [['GET', 'login:' + k], ['GET', 'emp:' + k]])) : [];
  const usedNow = new Map();
  const errors = [], cmds = [];
  let days = 0;
  rows.forEach((r, i) => {
    const id = ids[i], pin = String(r.pin || '').trim() || old[i]?.pin;
    if (!id) { errors.push(`Row ${i + 2}: name is empty`); return; }
    if (old[i]?.archived) { errors.push(`${r.name}: this person was removed. Restore them in Setup first.`); return; }
    if (!/^\d{4}$/.test(pin || '')) errors.push(`${r.name}: PIN must be 4 digits`);
    for (const [d, c0] of Object.entries(r.days)) {
      let c = String(c0 || '').trim().replace(/\s+/g, ' ') || 'OFF';
      const k = keyOf(c);
      if (k === 'off') c = 'OFF';
      else if (byKey[k]) c = byKey[k]; // "Kasir Go" matches "Kasir go" from Setup
      else errors.push(`${r.name} on ${d}: unknown shift code "${c}"`);
      cmds.push(['SET', `sched:${d}:${id}`, c]);
      days++;
    }
    let loc = old[i]?.loc ?? null; // no Location column in the file = keep what is saved
    if (r.loc !== undefined) {
      const parts = splitLoc(r.loc);
      if (!parts.length || (parts.length === 1 && ['all', 'semua'].includes(parts[0].toLowerCase()))) loc = null;
      else {
        const bad = parts.filter(p => !offices.some(o => o.id === slug(p)));
        if (bad.length) errors.push(`${r.name}: unknown location "${bad[0]}"`);
        else { const ids = [...new Set(parts.map(slug))]; loc = ids.length === 1 ? ids[0] : ids; }
      }
    }
    // Login name = what the employee types to sign in. Payroll name stays the full name in "Name".
    let phone = old[i]?.phone;
    if (r.phone !== undefined) { const p = normPhone(r.phone); if (p === null) errors.push(`${r.name}: the WhatsApp number looks wrong`); else phone = p || undefined; }
    let login = old[i]?.login, loginId = old[i]?.loginId;
    if (r.login !== undefined) {
      const w = wantLogin[i];
      if (!w) { login = undefined; loginId = undefined; }
      else {
        const k = keys.indexOf(w), owner = owners[2 * k], empAtSlug = owners[2 * k + 1];
        if ((owner && owner !== id) || (empAtSlug && w !== id) || (usedNow.has(w) && usedNow.get(w) !== id)) errors.push(`${r.name}: login name "${r.login}" is already used by someone else`);
        else { login = String(r.login).trim(); loginId = w; usedNow.set(w, id); }
      }
      if (old[i]?.loginId && old[i].loginId !== loginId) cmds.push(['DEL', 'login:' + old[i].loginId]);
      if (loginId) cmds.push(['SET', 'login:' + loginId, id]);
    }
    cmds.push(['SET', 'emp:' + id, JSON.stringify({ name: String(r.name).trim(), pin, loc, pay: old[i]?.pay, login, loginId, phone })], ['SADD', 'emps', id]);
  });
  if (errors.length) return json({ errors: errors.slice(0, 20) }, 400);
  await rp(env, cmds);
  return json({ ok: true, employees: rows.length, days });
}
