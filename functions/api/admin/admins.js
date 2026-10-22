import { json, rp, r1, slug, pbkdf, randId, gate, audit, ROLES } from '../../_lib.js';

// Admin accounts (owner only). Each HR person or manager gets their own username and password.
export async function onRequestGet({ request, env }) {
  const adm = await gate(request, env, 'admins'); if (adm instanceof Response) return adm;
  const all = await r1(env, 'HGETALL', 'admins'), list = [];
  for (let i = 0; i < all.length; i += 2) { const a = JSON.parse(all[i + 1]); list.push({ user: all[i], name: a.name, role: a.role, off: !!a.off }); }
  return json({ list: list.sort((a, b) => a.name.localeCompare(b.name)) });
}

export async function onRequestPost({ request, env }) {
  const adm = await gate(request, env, 'admins'); if (adm instanceof Response) return adm;
  const b = await request.json(), user = slug(b.user || '');
  if (!user || user === 'owner') return json({ error: 'Pick a username (letters and numbers), not "owner".' }, 400);
  const raw = await r1(env, 'HGET', 'admins', user), cur = raw ? JSON.parse(raw) : null;
  if (b.action === 'remove') {
    if (!cur) return json({ error: 'Not found' }, 400);
    await r1(env, 'HDEL', 'admins', user);
    await audit(env, adm, 'Removed admin', `${cur.name} (${user})`);
    return json({ ok: true });
  }
  if (b.action === 'save') {
    const name = String(b.name || '').trim().slice(0, 40), role = b.role;
    if (!name) return json({ error: 'Enter a name' }, 400);
    if (!['hr', 'manager'].includes(role)) return json({ error: 'Pick a role' }, 400);
    const pw = String(b.password || '');
    if (!cur && !pw) return json({ error: 'Set a password for the new admin' }, 400);
    if (pw && pw.length < 8) return json({ error: 'Password must be at least 8 characters' }, 400);
    const next = { ...(cur || {}), name, role, off: !!b.off };
    if (pw) { next.salt = randId().slice(0, 16); next.hash = await pbkdf(pw, next.salt); }
    await r1(env, 'HSET', 'admins', user, JSON.stringify(next));
    if (pw || next.off) { // sign them out everywhere: a new password or a disabled account takes effect now
      const toks = await r1(env, 'SMEMBERS', 'asessof:' + user);
      if (toks.length) await rp(env, [['DEL', ...toks.map(t => 'asess:' + t)], ['DEL', 'asessof:' + user]]);
    }
    await audit(env, adm, cur ? 'Changed admin' : 'Added admin', `${name} (${user}) · ${ROLES[role]}${next.off ? ' · disabled' : ''}${pw ? ' · new password' : ''}`);
    return json({ ok: true });
  }
  return json({ error: 'Bad request' }, 400);
}
