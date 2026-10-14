import { json, jget, jset, isAdmin, noAdmin } from '../../_lib.js';

export async function onRequestGet({ request, env }) {
  if (!isAdmin(request, env)) return noAdmin();
  return json({ shifts: await jget(env, 'shifts'), office: await jget(env, 'office') });
}

export async function onRequestPost({ request, env }) {
  if (!isAdmin(request, env)) return noAdmin();
  const b = await request.json();
  if (b.shifts) {
    const map = {};
    for (const s of b.shifts) {
      const code = String(s.code).trim().toUpperCase();
      if (!code || code === 'OFF') continue;
      if (!/^\d{1,2}:\d{2}$/.test(s.start) || !/^\d{1,2}:\d{2}$/.test(s.end)) return json({ error: `Shift ${code}: times must look like 07:00` }, 400);
      map[code] = { start: s.start, end: s.end };
    }
    await jset(env, 'shifts', map);
  }
  if (b.office) {
    const { lat, lng, radius } = b.office;
    if (![lat, lng].every(Number.isFinite)) return json({ error: 'Office latitude and longitude must be numbers' }, 400);
    await jset(env, 'office', { lat, lng, radius: Number(radius) || 150 });
  }
  return json({ ok: true });
}
