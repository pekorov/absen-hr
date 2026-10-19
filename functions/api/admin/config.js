import { json, jget, jset, slug, getOffices, isAdmin, noAdmin } from '../../_lib.js';

export async function onRequestGet({ request, env }) {
  if (!isAdmin(request, env)) return noAdmin();
  return json({ shifts: await jget(env, 'shifts'), offices: await getOffices(env) });
}

export async function onRequestPost({ request, env }) {
  if (!isAdmin(request, env)) return noAdmin();
  const b = await request.json();
  if (b.shifts) {
    const map = {}, seen = new Set();
    for (const s of b.shifts) {
      const code = String(s.code).trim().replace(/\s+/g, ' ');
      if (!code || code.toUpperCase() === 'OFF') continue;
      if (!/^\d{1,2}:\d{2}$/.test(s.start) || !/^\d{1,2}:\d{2}$/.test(s.end)) return json({ error: `Shift ${code}: times must look like 07:00` }, 400);
      if (seen.has(code.toLowerCase())) return json({ error: `Shift code "${code}" appears twice (capital letters do not make a different code).` }, 400);
      seen.add(code.toLowerCase());
      map[code] = { start: s.start, end: s.end };
    }
    await jset(env, 'shifts', map);
  }
  if (b.offices) {
    const list = [];
    for (const o of b.offices) {
      const name = String(o.name || '').trim(), id = slug(name);
      if (!id) return json({ error: 'Every location needs a name' }, 400);
      if (![o.lat, o.lng].every(Number.isFinite)) return json({ error: `${name}: latitude and longitude must be numbers` }, 400);
      if (list.some(x => x.id === id)) return json({ error: `Duplicate location name: ${name}` }, 400);
      list.push({ id, name, lat: o.lat, lng: o.lng, radius: Number(o.radius) || 150 });
    }
    await jset(env, 'offices', list);
  }
  return json({ ok: true });
}
