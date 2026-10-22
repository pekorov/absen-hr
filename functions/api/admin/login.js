import { json, rp, r1, jget, slug, sha, pbkdf, randId, gate, auditCmds, ROLES } from '../../_lib.js';

// Sign in: username + password. Leave the username empty (or type "owner") for the owner password (ADMIN_PASSWORD).
// 5 wrong tries for a username, or from one internet connection, locks sign-in for 15 minutes.
export async function onRequestPost({ request, env }) {
  const b = await request.json().catch(() => ({}));
  if (b.action === 'logout') {
    const t = request.headers.get('x-admin');
    if (t) await r1(env, 'DEL', 'asess:' + t);
    return json({ ok: true });
  }
  if (b.action === 'me') {
    const s = await gate(request, env, 'ops');
    return s instanceof Response ? s : json({ name: s.name, role: s.role });
  }
  const user = slug(b.user || '') || 'owner', pw = String(b.password || '');
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const [fu, fi] = await rp(env, [['GET', 'afail:' + user], ['GET', 'afailip:' + ip]]);
  if (Number(fu || 0) >= 5 || Number(fi || 0) >= 10) return json({ error: 'Too many wrong tries. Wait 15 minutes and try again.' }, 429);
  let who = null;
  if (user === 'owner') {
    // Compare scrambled values so the check takes the same time whatever is typed.
    if (env.ADMIN_PASSWORD && pw && (await sha('a|' + pw)) === (await sha('a|' + env.ADMIN_PASSWORD))) who = { u: 'owner', name: 'Owner', role: 'owner' };
  } else {
    const raw = await r1(env, 'HGET', 'admins', user), a = raw ? JSON.parse(raw) : null;
    if (a && !a.off && pw && (await pbkdf(pw, a.salt)) === a.hash) who = { u: user, name: a.name, role: a.role };
  }
  if (!who) {
    await rp(env, [['INCR', 'afail:' + user], ['EXPIRE', 'afail:' + user, 900], ['INCR', 'afailip:' + ip], ['EXPIRE', 'afailip:' + ip, 900],
      ...auditCmds(null, 'Failed admin sign-in', `username "${user}"`)]);
    return json({ error: 'Wrong username or password' }, 401);
  }
  const token = randId();
  await rp(env, [['SET', 'asess:' + token, JSON.stringify(who), 'EX', 43200], ['SADD', 'asessof:' + who.u, token], ['EXPIRE', 'asessof:' + who.u, 43200], ['DEL', 'afail:' + user], ...auditCmds(who, 'Signed in', ROLES[who.role])]);
  return json({ ok: true, token, name: who.name, role: who.role });
}
