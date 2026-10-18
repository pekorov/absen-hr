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
export async function auth(req, env) {
  const x = req.headers.get('x-user'), pin = req.headers.get('x-pin');
  if (!x || !pin) return null;
  // The login name can differ from the payroll name: login:<slug> points to the employee id.
  const id = (await r1(env, 'GET', 'login:' + x)) || x;
  const [ev, fails] = await rp(env, [['GET', 'emp:' + id], ['GET', 'fail:' + id]]);
  const e = ev ? JSON.parse(ev) : null;
  if (Number(fails || 0) >= 5) return null; // locked for 15 minutes after 5 wrong PINs
  if (e && e.archived) return null; // removed by HR
  if (e && e.loginId && x !== e.loginId) return null; // this person must use their login name
  if (e && e.pin === pin) { if (fails) await r1(env, 'DEL', 'fail:' + id); return { id, ...e }; }
  if (e) await rp(env, [['INCR', 'fail:' + id], ['EXPIRE', 'fail:' + id, 900]]);
  return null;
}
export const isAdmin = (req, env) => !!env.ADMIN_PASSWORD && req.headers.get('x-admin') === env.ADMIN_PASSWORD;
export const noAdmin = () => json({ error: 'Wrong admin password' }, 401);

// Location + selfie checks. Returns a list of reasons; empty means all good.
export async function geoWhy(env, u, b, needPhoto = true, chk = null) {
  const why = [];
  if (typeof b.lat !== 'number' || typeof b.lng !== 'number') why.push('no_location');
  else {
    const last = await jget(env, 'last:' + u.id);
    if (chk && chk.outside) why.push('outside_office');
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

// Which restaurant is the phone at, and is this employee allowed to clock in there?
// u.loc = the one location an employee is limited to (null = any restaurant).
// Clock-in is blocked when not at an allowed restaurant. Clock-out is only flagged
// for review, so nobody gets stuck with an open shift after leaving.
export async function placeCheck(env, u, lat, lng, accuracy = 0, type = 'in') {
  const offices = await getOffices(env);
  if (!offices.length) return { place: null, outside: false, blocked: null };
  const tol = Math.min(Number(accuracy) || 0, 50); // allow for normal GPS wobble
  const d = o => dist(lat, lng, o.lat, o.lng);
  const inside = offices.filter(o => d(o) - tol <= (o.radius || 150));
  const block = msg => (type === 'in' ? msg : null);
  if (u.loc) {
    const mine = offices.find(o => o.id === u.loc);
    if (!mine) return { place: null, outside: true, blocked: block('Your work location is not set up. Please ask your manager.') };
    if (inside.some(o => o.id === mine.id)) return { place: mine.name, outside: false, blocked: null };
    const other = inside[0];
    return { place: other ? other.name : null, outside: true, blocked: block(other
      ? `You can only clock in at ${mine.name}. You are at ${other.name}.`
      : `You are not at ${mine.name} (about ${fmtDist(d(mine))} away). Go there to clock in.`) };
  }
  if (inside.length) return { place: inside[0].name, outside: false, blocked: null };
  const near = offices.map(o => ({ o, m: d(o) })).sort((a, b) => a.m - b.m)[0];
  return { place: null, outside: true, blocked: block(`You are not at a restaurant (nearest: ${near.o.name}, about ${fmtDist(near.m)} away). Go there to clock in.`) };
}

// Yesterday's unfinished record only counts as "still clocked in" for a night shift that
// crosses midnight, and only for 3 hours after that shift ends. Otherwise it was a missed clock-out.
export function stillOpenFromYesterday(rec, shifts, nm) {
  const sh = rec && !rec.out && rec.code && shifts && shifts[rec.code];
  if (!sh) return false;
  return hm(sh.end) <= hm(sh.start) && nm <= hm(sh.end) + 180;
}

// Auto clock-out: a shift still open 3 hours after its scheduled end is closed at the scheduled end time.
// Only the clock-out time is filled in; pay still follows the schedule. HR can change the time afterwards.
export function autoOut(rec, date, shifts, todayStr, nm) {
  if (!rec || rec.out || !rec.in) return null;
  const sh = rec.code && shifts && shifts[rec.code];
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
