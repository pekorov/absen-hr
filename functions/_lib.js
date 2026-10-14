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
  const id = req.headers.get('x-user'), pin = req.headers.get('x-pin');
  if (!id || !pin) return null;
  const e = await jget(env, 'emp:' + id);
  return e && e.pin === pin ? { id, ...e } : null;
}
export const isAdmin = (req, env) => !!env.ADMIN_PASSWORD && req.headers.get('x-admin') === env.ADMIN_PASSWORD;
export const noAdmin = () => json({ error: 'Wrong admin password' }, 401);

// Location + selfie checks. Returns a list of reasons; empty means all good.
export async function geoWhy(env, u, b) {
  const why = [];
  if (typeof b.lat !== 'number' || typeof b.lng !== 'number') why.push('no_location');
  else {
    const [office, last] = await Promise.all([jget(env, 'office'), jget(env, 'last:' + u.id)]);
    if (office && dist(b.lat, b.lng, office.lat, office.lng) > (office.radius || 150)) why.push('outside_office');
    if (b.accuracy > 50) why.push('low_accuracy');
    if (last) {
      const h = (Date.now() - last.at) / 36e5;
      if (h > 0 && dist(b.lat, b.lng, last.lat, last.lng) / 1000 / h > 150) why.push('impossible_travel');
    }
    await jset(env, 'last:' + u.id, { lat: b.lat, lng: b.lng, at: Date.now() });
  }
  if (typeof b.photo !== 'string' || !b.photo.startsWith('data:image/') || b.photo.length > 60000) why.push('no_selfie');
  return why;
}
