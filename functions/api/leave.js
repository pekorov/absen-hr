import { say } from '../_msg.js';
import { json, rp, r1, auth, today, addDays, auditCmds } from '../_lib.js';
import { showName } from '../_swap.js';

// Employee leave requests. HR approves or rejects them in Review; approved days become paid annual leave.
export async function onRequestGet({ request, env }) {
  const u = await auth(request, env);
  if (!u) return json({ error: say(request, 'Wrong name or PIN') }, 401);
  const all = await r1(env, 'HGETALL', 'lreqs'), list = [];
  for (let i = 0; i < all.length; i += 2) { const r = JSON.parse(all[i + 1]); if (r.id === u.id) list.push(r); }
  return json({ list: list.sort((a, b) => b.at - a.at).slice(0, 10).map(({ id, name, ...r }) => r) });
}

export async function onRequestPost({ request, env }) {
  const u = await auth(request, env);
  if (!u) return json({ error: say(request, 'Wrong name or PIN') }, 401);
  const b = await request.json().catch(() => ({})), sys = { name: showName(u) + ' (employee)' };
  if (b.action === 'cancel') {
    const raw = await r1(env, 'HGET', 'lreqs', String(b.uid || '')), r = raw ? JSON.parse(raw) : null;
    if (!r || r.id !== u.id || r.status !== 'waiting') return json({ error: say(request, 'This request can no longer be cancelled.') }, 400);
    await rp(env, [['HDEL', 'lreqs', r.uid], ...auditCmds(sys, 'Cancelled a leave request', `${r.from} to ${r.to}`)]);
    return json({ ok: true });
  }
  if (b.action !== 'create') return json({ error: say(request, 'Bad request') }, 400);
  const re = /^\d{4}-\d{2}-\d{2}$/, t = today();
  if (!re.test(b.from || '') || !re.test(b.to || '') || b.to < b.from) return json({ error: say(request, 'Pick a From and To date.') }, 400);
  if (b.from < t) return json({ error: say(request, 'Leave must start today or later.') }, 400);
  if (b.from > addDays(t, 120)) return json({ error: say(request, 'Leave can be requested up to 4 months ahead.') }, 400);
  if (b.to > addDays(b.from, 13)) return json({ error: say(request, 'One request can be at most 14 days.') }, 400);
  const all = await r1(env, 'HGETALL', 'lreqs');
  let open = 0;
  for (let i = 0; i < all.length; i += 2) { const r = JSON.parse(all[i + 1]); if (r.id === u.id && r.status === 'waiting') open++; }
  if (open >= 3) return json({ error: say(request, 'You already have 3 leave requests waiting.') }, 400);
  const r = { uid: crypto.randomUUID().slice(0, 10), id: u.id, name: u.name, show: showName(u), from: b.from, to: b.to, note: String(b.note || '').slice(0, 120), status: 'waiting', at: Date.now() };
  await rp(env, [['HSET', 'lreqs', r.uid, JSON.stringify(r)], ...auditCmds(sys, 'Asked for annual leave', `${b.from} to ${b.to}`)]);
  return json({ ok: true });
}
