export const TZ = 7; // WIB = UTC+7. Use 8 for WITA, 9 for WIT.
export const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json' } });
export async function rp(env, cmds) {
  const r = await fetch(env.UPSTASH_REDIS_REST_URL + '/pipeline', { method: 'POST', headers: { Authorization: 'Bearer ' + env.UPSTASH_REDIS_REST_TOKEN }, body: JSON.stringify(cmds) });
  if (!r.ok) throw new Error('Upstash error ' + r.status);
  return (await r.json()).map(x => x.result);
}
export const r1 = async (env, ...c) => (await rp(env, [c]))[0];
export const jget = async (env, k) => { const v = await r1(env, 'GET', k); return v ? JSON.parse(v) : null; };
export const jset = (env, k, v) => r1(env, 'SET', k, JSON.stringify(v));
export const slug = n => String(n).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const wib = () => new Date(Date.now() + TZ * 36e5);
export const today = () => wib().toISOString().slice(0, 10);
export const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
export const nowMin = () => { const d = wib(); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
export const stamp = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
export const hm = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
export const dist = (a, b, c, d) => { const r = Math.PI / 180, x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2; return 12742000 * Math.asin(Math.sqrt(x)); };
// PINs are stored scrambled (hashed), so nobody looking at the database can read them.
const te = new TextEncoder();
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
export const sha = async s => hex(await crypto.subtle.digest('SHA-256', te.encode(s)));
export const pinHash = (env, id, pin) => sha(`${env.PIN_SECRET || 'kurogi-absen'}|${id}|${pin}`);
export async function pbkdf(pw, salt) {
  const k = await crypto.subtle.importKey('raw', te.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: te.encode(salt), iterations: 5000 }, k, 256));
}
export const randId = () => crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');

export async function auth(req, env) {
  const x = req.headers.get('x-user'), pin = req.headers.get('x-pin');
  if (!x || !pin) return null;
  // The login name can differ from the payroll name: login:<slug> points to the employee id.
  const id = (await r1(env, 'GET', 'login:' + x)) || x;
  const [ev, fails] = await rp(env, [['GET', 'emp:' + id], ['GET', 'fail:' + id]]);
  const e = ev ? JSON.parse(ev) : null;
  if (Number(fails || 0) >= 5) return null; // locked for 15 minutes after 5 wrong PINs
  if (!e || e.archived) return null; // unknown, or removed by HR
  if (e.loginId && x !== e.loginId) return null; // this person must use their login name
  const ok = e.pinH ? e.pinH === await pinHash(env, id, pin) : e.pin === pin;
  if (ok) {
    const cmds = [];
    if (fails) cmds.push(['DEL', 'fail:' + id]);
    if (!e.pinH) { e.pinH = await pinHash(env, id, pin); delete e.pin; cmds.push(['SET', 'emp:' + id, JSON.stringify(e)]); } // upgrade an old plain PIN
    if (cmds.length) await rp(env, cmds);
    const { pinH, pin: _p, ...safe } = e;
    return { id, ...safe };
  }
  await rp(env, [['INCR', 'fail:' + id], ['EXPIRE', 'fail:' + id, 900]]);
  return null;
}

// Admin sign-in: the owner (ADMIN_PASSWORD) or a named admin account. Each sign-in gets a session for 12 hours.
// Roles: owner = everything; hr = everything except admin accounts; manager = Review, Today, Schedule, requests.
export const ADMIN_IDLE = 5 * 3600; // seconds
export const ROLES = { owner: 'Owner', hr: 'HR', manager: 'Manager' };
export const can = (role, area) => role === 'owner' || (role === 'hr' && area !== 'admins') || (role === 'manager' && area === 'ops');
export async function gate(req, env, area = 'ops') {
  const t = req.headers.get('x-admin');
  if (!t || t.length < 40) return noAdmin();
  const s = await jget(env, 'asess:' + t);
  if (!s) return noAdmin();
  // Each request restarts the 5-hour clock; 5 hours without any request = signed out.
  await rp(env, [['EXPIRE', 'asess:' + t, ADMIN_IDLE], ['EXPIRE', 'asessof:' + s.u, ADMIN_IDLE]]);
  if (!can(s.role, area)) return json({ error: 'Your admin login is not allowed to do this. Ask the owner.' }, 403);
  return s; // { u, name, role }
}
export const noAdmin = () => json({ error: 'Please sign in again' }, 401);
// Activity log: who changed what, newest first, last 1000 entries.
export const auditCmds = (adm, act, detail = '') => [['LPUSH', 'audit', JSON.stringify({ at: Date.now(), by: adm ? adm.name : 'system', act, detail: String(detail).slice(0, 200) })], ['LTRIM', 'audit', 0, 999]];
export const audit = (env, adm, act, detail) => rp(env, auditCmds(adm, act, detail));

// Location + selfie checks. Returns a list of reasons; empty means all good.
export async function geoWhy(env, u, b, needPhoto = true, chk = null) {
  const why = [];
  if (typeof b.lat !== 'number' || typeof b.lng !== 'number') why.push('no_location');
  else {
    const last = await jget(env, 'last:' + u.id);
    if (chk && chk.outside) why.push('outside_office');
    if (chk && chk.noQr) why.push('no_qr');
    if (b.accuracy > 50) why.push('low_accuracy');
    if (last) {
      const h = (Date.now() - last.at) / 36e5;
      if (h > 0 && dist(b.lat, b.lng, last.lat, last.lng) / 1000 / h > 150) why.push('impossible_travel');
    }
    await jset(env, 'last:' + u.id, { lat: b.lat, lng: b.lng, at: Date.now() });
  }
  if (needPhoto && (typeof b.photo !== 'string' || !b.photo.startsWith('data:image/') || b.photo.length > 120000)) why.push('no_selfie');
  return why;
}

// Restaurant locations. Falls back to the older single "office" setting.
export async function getOffices(env) {
  const list = await jget(env, 'offices');
  if (list && list.length) return list;
  const old = await jget(env, 'office');
  return old ? [{ id: 'main', name: 'Main office', ...old }] : [];
}

const fmtDist = m => (m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(1) + ' km');

// QR check (beta). A tablet at the counter shows a code that changes every 30 seconds:
// code = HMAC(branch kiosk key, time slot). Per branch: qr = 'off' | 'test' (missing QR only flagged) | 'on' (required).
export async function qrCode(kkey, slot) {
  const k = await crypto.subtle.importKey('raw', te.encode(kkey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, te.encode(String(slot)))).slice(0, 10);
}
export async function qrValid(o, qr) {
  const [oid, code] = String(qr || '').split('.');
  if (!o.kkey || oid !== o.id || !code) return false;
  const s = Math.floor(Date.now() / 30000);
  for (let i = -3; i <= 1; i++) if ((await qrCode(o.kkey, s + i)) === code) return true; // about 2 minutes to walk from the tablet
  return false;
}

// Which restaurant is the phone at, and is this employee allowed to clock in there?
// u.loc = the place(s) an employee is limited to (empty = any restaurant).
// Clock-in is blocked when not at an allowed restaurant. Clock-out is only flagged
// for review, so nobody gets stuck with an open shift after leaving.
export async function placeCheck(env, u, lat, lng, accuracy = 0, type = 'in', qr = '') {
  const offices = await getOffices(env);
  if (!offices.length) return { place: null, outside: false, blocked: null };
  const tol = Math.min(Number(accuracy) || 0, 50); // allow for normal GPS wobble
  const d = o => dist(lat, lng, o.lat, o.lng);
  const inside = offices.filter(o => d(o) - tol <= (o.radius || 150));
  const block = msg => (type === 'in' ? msg : null);
  const at = async o => {
    const res = { place: o.name, outside: false, blocked: null };
    if (type !== 'in' || !o.qr || o.qr === 'off' || await qrValid(o, qr)) return res;
    if (o.qr === 'on') return { ...res, blocked: 'Scan the QR code on the counter tablet with your phone camera, then tap Clock in again.', needQr: true };
    return { ...res, noQr: true }; // test mode: clock-in goes through, HR sees it in Review
  };
  const ids = locsOf(u.loc); // places this person may use (empty = any restaurant)
  if (ids.length) {
    const mine = offices.filter(o => ids.includes(o.id));
    if (!mine.length) return { place: null, outside: true, blocked: block('Your work location is not set up. Please ask your manager.') };
    const here = inside.find(o => ids.includes(o.id));
    if (here) return at(here);
    const names = mine.map(o => o.name).join(' or ');
    if (inside.length) return { place: inside[0].name, outside: true, blocked: block(`You can only clock in at ${names}. You are at ${inside[0].name}.`) };
    const near = mine.map(o => ({ o, m: d(o) })).sort((a, b) => a.m - b.m)[0];
    return { place: null, outside: true, blocked: block(`You are not at ${names} (about ${fmtDist(near.m)} from ${near.o.name}). Go there to clock in.`) };
  }
  if (inside.length) return at(inside[0]);
  const near = offices.map(o => ({ o, m: d(o) })).sort((a, b) => a.m - b.m)[0];
  return { place: null, outside: true, blocked: block(`You are not at a restaurant (nearest: ${near.o.name}, about ${fmtDist(near.m)} away). Go there to clock in.`) };
}

// Do two people work at the same place? (no limit = any place)
export const sharePlace = (a, b) => { const x = locsOf(a.loc), y = locsOf(b.loc); return !x.length || !y.length || x.some(i => y.includes(i)); };
export const shiftHours = sh => { let h = (hm(sh.end) - hm(sh.start)) / 60; if (h <= 0) h += 24; return h; };
export const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);

// Yesterday's unfinished record only counts as "still clocked in" for a night shift that
// crosses midnight, and only for 3 hours after that shift ends. Otherwise it was a missed clock-out.
export function stillOpenFromYesterday(rec, shifts, nm) {
  const sh = rec && !rec.out && shiftOf(shifts, rec.code);
  if (!sh) return false;
  return hm(sh.end) <= hm(sh.start) && nm <= hm(sh.end) + 180;
}

// Auto clock-out: a shift still open 3 hours after its scheduled end is closed at the scheduled end time.
// Only the clock-out time is filled in; pay still follows the schedule. HR can change the time afterwards.
export function autoOut(rec, date, shifts, todayStr, nm) {
  if (!rec || rec.out || !rec.in) return null;
  const sh = shiftOf(shifts, rec.code);
  if (!sh) return null;
  const st = hm(sh.start), en = hm(sh.end), cross = en <= st;
  const now = Math.round((Date.parse(todayStr + 'T00:00:00Z') - Date.parse(date + 'T00:00:00Z')) / 864e5) * 1440 + nm;
  if (now < (cross ? 1440 : 0) + en + 180) return null;
  const outMin = cross ? en : Math.max(en, hm(rec.in));
  return { ...rec, out: stamp(outMin), outBy: 'auto', fl: [...new Set([...(rec.fl || []), 'auto_clock_out'])] };
}

// WhatsApp number -> international digits (62812...). '' = none, null = looks wrong.
export function normPhone(v) {
  const raw = String(v ?? '').trim();
  if (!raw) return '';
  let d = raw.replace(/[^\d]/g, '').replace(/^00/, '');
  if (!d) return null; // text with no digits
  if (d.startsWith('0')) d = '62' + d.slice(1);
  else if (d.startsWith('8')) d = '62' + d;
  return /^\d{9,15}$/.test(d) ? d : null;
}

// Location cell: one place, or several separated by comma, ; / | & dan and  ("Cabang A, Cabang B").
export const locsOf = v => (Array.isArray(v) ? v : v ? [v] : []);
export const splitLoc = s => String(s || '').split(/\s*(?:,|;|\||\/|&|\bdan\b|\band\b)\s*/i).map(x => x.trim()).filter(Boolean);

// Shift swap rules: auto = no admin approval needed once the colleague accepts; hours = how long before the shift a swap must be settled.
export const swapRules = c => ({ auto: !!(c && c.auto), hours: c && Number.isFinite(c.hours) ? c.hours : 3 });

// An employee can undo their own clock-out for 15 minutes (for a wrong tap).
export const UNDO_MS = 15 * 60e3;
export const undoUntil = r => (r && r.out && r.outBy === 'self' && Date.now() - (r.outAt || 0) < UNDO_MS ? r.outAt + UNDO_MS : 0);

// Double shift: two (or more) shift codes on one day, written "M + Md" and saved as "M+Md".
// It works as ONE long shift: one clock-in at the first start, one clock-out at the last end.
// Paid hours = the shifts' own hours added up (breaks between them are not paid), still capped per day.
export const splitCode = c => String(c || '').split('+').map(x => x.trim()).filter(Boolean);
export function shiftOf(shifts, code) {
  if (!code || code === 'OFF' || !shifts) return null;
  if (shifts[code]) return { ...shifts[code], hours: shiftHours(shifts[code]), parts: [code] };
  const parts = splitCode(code);
  if (parts.length < 2 || parts.some(p => !shifts[p])) return null;
  // Put the parts in the order that gives the shortest day (so "E + Md" works across midnight too).
  const sorted = parts.map(p => ({ p, ...shifts[p] })).sort((a, b) => hm(a.start) - hm(b.start));
  let best = null;
  for (let r = 0; r < sorted.length; r++) {
    const list = [...sorted.slice(r), ...sorted.slice(0, r)], s0 = hm(list[0].start);
    const span = Math.max(...list.map(x => ((hm(x.start) - s0 + 1440) % 1440) + shiftHours(x) * 60));
    if (!best || span < best.span) best = { list, span, s0 };
  }
  const { list, span, s0 } = best;
  return { start: list[0].start, end: stamp((s0 + span) % 1440), hours: list.reduce((n, x) => n + shiftHours(x), 0), parts: list.map(x => x.p), segs: list.map(x => ({ code: x.p, start: x.start, end: x.end })), double: true };
}
