import { json, jget, jset, slug, getOffices, randId, swapRules, shiftHours, gate, audit } from '../../_lib.js';
import { maxHours } from '../../_payroll.js';

export async function onRequestGet({ request, env }) {
  const adm = await gate(request, env, 'ops'); if (adm instanceof Response) return adm;
  const offices = await getOffices(env);
  return json({
    shifts: await jget(env, 'shifts'),
    // kiosk keys only for owner and HR
    offices: offices.map(o => (adm.role === 'manager' ? { ...o, kkey: undefined } : o)),
    swap: swapRules(await jget(env, 'swapcfg')),
    me: { name: adm.name, role: adm.role },
  });
}

export async function onRequestPost({ request, env }) {
  const adm = await gate(request, env, 'setup'); if (adm instanceof Response) return adm;
  const b = await request.json(), did = [];
  let long = [];
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
    did.push('shift codes');
    const cap = maxHours((await jget(env, 'paysettings')) || {});
    long = Object.entries(map).filter(([, v]) => shiftHours(v) > cap).map(([k, v]) => `${k} is ${shiftHours(v)} hours: only ${cap} hours a day are paid; add the rest as overtime if you approve it.`);
  }
  if (b.offices) {
    const old = await getOffices(env), list = [];
    for (const o of b.offices) {
      const name = String(o.name || '').trim(), id = slug(name);
      if (!id) return json({ error: 'Every location needs a name' }, 400);
      if (![o.lat, o.lng].every(Number.isFinite)) return json({ error: `${name}: latitude and longitude must be numbers` }, 400);
      if (list.some(x => x.id === id)) return json({ error: `Duplicate location name: ${name}` }, 400);
      const prev = old.find(x => x.id === id) || {};
      const qr = ['off', 'test', 'on'].includes(o.qr) ? o.qr : 'off';
      // The kiosk key is made once per branch; "new key" makes the old tablet link stop working.
      const kkey = o.newKey ? randId().slice(0, 24) : prev.kkey || (qr !== 'off' ? randId().slice(0, 24) : undefined);
      list.push({ id, name, lat: o.lat, lng: o.lng, radius: Number(o.radius) || 150, qr, kkey });
    }
    await jset(env, 'offices', list);
    did.push('locations');
  }
  if (b.swap) {
    const hours = Math.max(0, Math.min(72, Math.round(Number(b.swap.hours) || 0)));
    await jset(env, 'swapcfg', { auto: !!b.swap.auto, hours });
    did.push('swap rules');
  }
  await audit(env, adm, 'Saved setup', did.join(', '));
  return json({ ok: true, warn: long });
}
