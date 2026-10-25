import { say } from '../_msg.js';
import { json, auth, placeCheck } from '../_lib.js';

// Quick check before the camera opens: is this person allowed to clock in/out here?
export async function onRequestPost({ request, env }) {
  const u = await auth(request, env);
  if (!u) return json({ error: say(request, 'Wrong name or PIN') }, 401);
  const b = await request.json().catch(() => ({}));
  if (typeof b.lat !== 'number' || typeof b.lng !== 'number') return json({ error: say(request, 'Location not detected.') }, 400);
  const chk = await placeCheck(env, u, b.lat, b.lng, b.accuracy, b.type, b.qr);
  return json({ ok: !chk.blocked, error: say(request, chk.blocked), place: chk.place, needQr: !!chk.needQr });
}
