import { json, rp, r1, jget, auth, today, addDays, sharePlace, swapRules, auditCmds } from '../_lib.js';
import { allEmployees } from '../_payroll.js';
import { checkSwap, applyCmds, kindOf, isOff, showName, allSwaps, describe } from '../_swap.js';

const live = s => (['waiting', 'accepted'].includes(s.status) && s.dA < today() ? { ...s, status: 'expired' } : s);
const view = (s, me) => { const { a, b, aN, bN, ...rest } = live(s); return { ...rest, mine: a === me, forMe: b === me }; };

// GET: my swaps, colleagues I can swap with, my next 14 days. GET ?with=<id>: that colleague's next 14 days.
export async function onRequestGet({ request, env }) {
  const u = await auth(request, env);
  if (!u) return json({ error: 'Wrong name or PIN' }, 401);
  const t = today(), days = [...Array(15)].map((_, i) => addDays(t, i));
  const withId = new URL(request.url).searchParams.get('with');
  if (withId) {
    const c = await jget(env, 'emp:' + withId);
    if (!c || c.archived || !sharePlace(u, c)) return json({ error: 'Not found' }, 404);
    const codes = (await rp(env, [['MGET', ...days.map(d => `sched:${d}:${withId}`)]]))[0];
    return json({ days: days.map((d, i) => ({ date: d, code: codes[i] || 'OFF' })) });
  }
  const [emps, swaps, mine, shifts, cfg] = await Promise.all([allEmployees(env), allSwaps(env), rp(env, [['MGET', ...days.map(d => `sched:${d}:${u.id}`), ...days.map(d => `leave:${d}:${u.id}`)]]).then(r => r[0]), jget(env, 'shifts'), jget(env, 'swapcfg')]);
  return json({
    rules: swapRules(cfg),
    colleagues: emps.filter(e => e.id !== u.id && !e.archived && sharePlace(u, e)).map(e => ({ id: e.id, name: showName(e) })).sort((a, b) => a.name.localeCompare(b.name)),
    days: days.map((d, i) => ({ date: d, code: mine[i] || 'OFF', leave: !!mine[15 + i], ...((shifts || {})[mine[i]] || {}) })),
    swaps: swaps.filter(s => s.a === u.id || s.b === u.id).slice(0, 20).map(s => view(s, u.id)),
  });
}

export async function onRequestPost({ request, env }) {
  const u = await auth(request, env);
  if (!u) return json({ error: 'Wrong name or PIN' }, 401);
  const b = await request.json().catch(() => ({}));
  const sys = { name: showName(u) + ' (employee)' };

  if (b.action === 'create') {
    const re = /^\d{4}-\d{2}-\d{2}$/;
    if (!re.test(b.dA || '') || (b.dB && !re.test(b.dB))) return json({ error: 'Pick a day' }, 400);
    if (b.with === u.id) return json({ error: 'Pick a colleague' }, 400);
    const B = await jget(env, 'emp:' + b.with);
    if (!B || B.archived) return json({ error: 'Pick a colleague' }, 400);
    const [cA, cB] = await rp(env, [['GET', `sched:${b.dA}:${u.id}`], ['GET', `sched:${b.dB || b.dA}:${b.with}`]]);
    if (isOff(cA)) return json({ error: 'You have no shift on that day.' }, 400);
    const kind = kindOf(b.dA, b.dB);
    if (kind !== 'give' && isOff(cB)) return json({ error: `${showName(B)} has no shift on that day.` }, 400);
    const all = await allSwaps(env), open = all.filter(s => s.a === u.id && ['waiting', 'accepted'].includes(live(s).status));
    if (open.length >= 5) return json({ error: 'You already have 5 open swap requests. Cancel one first.' }, 400);
    if (open.some(s => s.dA === b.dA || s.dB === b.dA)) return json({ error: 'You already asked to swap that day.' }, 400);
    const s = { uid: crypto.randomUUID().slice(0, 10), kind, a: u.id, b: b.with, aN: u.name, bN: B.name, aL: showName(u), bL: showName(B), dA: b.dA, cA, dB: kind === 'give' ? null : b.dB, cB: kind === 'give' ? null : cB, note: String(b.note || '').slice(0, 120), status: 'waiting', at: Date.now() };
    const err = await checkSwap(env, s);
    if (err) return json({ error: err }, 400);
    await rp(env, [['HSET', 'swaps', s.uid, JSON.stringify(s)], ...auditCmds(sys, 'Asked for a shift swap', describe(s))]);
    return json({ ok: true, swap: view(s, u.id) });
  }

  const raw = await r1(env, 'HGET', 'swaps', String(b.uid || '')), s = raw ? JSON.parse(raw) : null;
  if (!s || (s.a !== u.id && s.b !== u.id)) return json({ error: 'Request not found' }, 404);
  const st = live(s).status;

  if (b.action === 'cancel') {
    if (s.a !== u.id || !['waiting', 'accepted'].includes(st)) return json({ error: 'This request can no longer be cancelled.' }, 400);
    s.status = 'cancelled'; s.doneAt = Date.now();
    await rp(env, [['HSET', 'swaps', s.uid, JSON.stringify(s)], ...auditCmds(sys, 'Cancelled a shift swap', describe(s))]);
    return json({ ok: true });
  }
  if (s.b !== u.id || st !== 'waiting') return json({ error: 'This request is no longer waiting for you.' }, 400);
  if (b.action === 'decline') {
    s.status = 'declined'; s.doneAt = Date.now();
    await rp(env, [['HSET', 'swaps', s.uid, JSON.stringify(s)], ...auditCmds(sys, 'Declined a shift swap', describe(s))]);
    return json({ ok: true });
  }
  if (b.action === 'accept') {
    const err = await checkSwap(env, s);
    if (err) return json({ error: err }, 400);
    s.acceptedAt = Date.now();
    const auto = swapRules(await jget(env, 'swapcfg')).auto;
    if (auto) { s.status = 'approved'; s.decidedBy = 'automatic'; s.doneAt = Date.now(); }
    else s.status = 'accepted';
    await rp(env, [['HSET', 'swaps', s.uid, JSON.stringify(s)], ...(auto ? applyCmds(s) : []), ...auditCmds(sys, auto ? 'Accepted a shift swap (schedule changed)' : 'Accepted a shift swap', describe(s))]);
    return json({ ok: true, status: s.status });
  }
  return json({ error: 'Bad request' }, 400);
}
