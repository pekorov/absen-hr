import { json, rp, r1, today, addDays, gate, auditCmds } from '../../_lib.js';
import { checkSwap, applyCmds, allSwaps, describe } from '../../_swap.js';

// Shift swaps and leave requests from employees.
export async function onRequestGet({ request, env }) {
  const adm = await gate(request, env, 'ops'); if (adm instanceof Response) return adm;
  const t = today();
  const [swaps, lraw] = await Promise.all([allSwaps(env), r1(env, 'HGETALL', 'lreqs')]);
  const leave = [], drop = [];
  for (let i = 0; i < lraw.length; i += 2) {
    const r = JSON.parse(lraw[i + 1]);
    if (r.to < addDays(t, -60)) drop.push(lraw[i]); else leave.push(r);
  }
  if (drop.length) await r1(env, 'HDEL', 'lreqs', ...drop);
  const ids = [...new Set([...swaps.flatMap(s => [s.a, s.b]), ...leave.map(r => r.id)])];
  const emps = ids.length ? await rp(env, ids.map(i => ['GET', 'emp:' + i])) : [];
  const phone = Object.fromEntries(ids.map((id, k) => [id, (JSON.parse(emps[k] || '{}').phone) || '']));
  const live = s => (['waiting', 'accepted'].includes(s.status) && s.dA < t ? { ...s, status: 'expired' } : s);
  return json({
    swaps: swaps.map(live).slice(0, 40).map(s => ({ ...s, aPhone: phone[s.a], bPhone: phone[s.b] })),
    leave: leave.sort((a, b) => b.at - a.at).slice(0, 40).map(r => ({ ...r, phone: phone[r.id] })),
  });
}

export async function onRequestPost({ request, env }) {
  const adm = await gate(request, env, 'ops'); if (adm instanceof Response) return adm;
  const b = await request.json(), ok = b.decision === 'approve';
  if (!['approve', 'reject'].includes(b.decision)) return json({ error: 'Bad decision' }, 400);
  if (b.kind === 'swap') {
    const raw = await r1(env, 'HGET', 'swaps', String(b.uid || '')), s = raw ? JSON.parse(raw) : null;
    if (!s || s.status !== 'accepted') return json({ error: 'This swap is not waiting for approval.' }, 400);
    if (ok) { const err = await checkSwap(env, s); if (err) return json({ error: err }, 400); }
    s.status = ok ? 'approved' : 'rejected'; s.decidedBy = adm.name; s.doneAt = Date.now();
    await rp(env, [['HSET', 'swaps', s.uid, JSON.stringify(s)], ...(ok ? applyCmds(s) : []), ...auditCmds(adm, ok ? 'Approved shift swap' : 'Rejected shift swap', describe(s))]);
    return json({ ok: true });
  }
  if (b.kind === 'leave') {
    const raw = await r1(env, 'HGET', 'lreqs', String(b.uid || '')), r = raw ? JSON.parse(raw) : null;
    if (!r || r.status !== 'waiting') return json({ error: 'This leave request is not waiting.' }, 400);
    r.status = ok ? 'approved' : 'rejected'; r.decidedBy = adm.name; r.doneAt = Date.now();
    const cmds = [['HSET', 'lreqs', r.uid, JSON.stringify(r)], ...auditCmds(adm, ok ? 'Approved leave request' : 'Rejected leave request', `${r.name} · ${r.from} to ${r.to}`)];
    if (ok) for (let d = r.from; d <= r.to; d = addDays(d, 1)) cmds.push(['SET', `leave:${d}:${r.id}`, '1']);
    await rp(env, cmds);
    return json({ ok: true });
  }
  return json({ error: 'Bad request' }, 400);
}
