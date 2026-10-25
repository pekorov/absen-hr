import { json, rp, r1, today, addDays, gate, audit } from '../../_lib.js';

// Flagged clock-ins. Each comes with the person's profile photo (if set) to compare with the selfie.
export async function onRequestGet({ request, env }) {
  const adm = await gate(request, env, 'ops'); if (adm instanceof Response) return adm;
  const keys = await r1(env, 'SMEMBERS', 'review');
  if (!keys.length) return json([]);
  const res = await rp(env, keys.flatMap(k => { const [d, id] = k.split('|'); return [['GET', `att:${d}:${id}`], ['GET', 'emp:' + id], ['GET', `ph:${d}:${id}`], ['GET', 'ref:' + id]]; }));
  // No profile photo yet (people who started before this feature): use their oldest selfie still stored.
  const missing = [...new Set(keys.map((k, i) => !res[4 * i + 3] && k.split('|')[1]).filter(Boolean))];
  if (missing.length) {
    const t = today(), dates = Array.from({ length: 61 }, (_, i) => addDays(t, i - 60)); // oldest first
    const found = await rp(env, missing.map(id => ['MGET', ...dates.map(d => `ph:${d}:${id}`)]));
    const sets = [];
    missing.forEach((id, n) => { const ph = found[n].find(Boolean); if (ph) { sets.push(['SET', 'ref:' + id, ph, 'NX']); keys.forEach((k, i) => { if (k.split('|')[1] === id) res[4 * i + 3] = ph; }); } });
    if (sets.length) await rp(env, sets);
  }
  const list = keys.map((k, i) => {
    const a = JSON.parse(res[4 * i] || 'null'), e = JSON.parse(res[4 * i + 1] || 'null');
    return a && { key: k, date: k.split('|')[0], name: e?.name || k, ...a, ph: res[4 * i + 2] || a.ph, ref: res[4 * i + 3] || null };
  }).filter(Boolean).sort((x, y) => x.date.localeCompare(y.date));
  // Duplicate-photo flags: send the earlier matching selfie too, so HR can compare side by side.
  const want = [...new Set(list.flatMap(x => [x.dupOf, x.simTo, x.simWho]).filter(Boolean))];
  if (want.length) {
    const got = await rp(env, want.flatMap(m => { const [d, id] = m.split('|'); return [['GET', `ph:${d}:${id}`], ['GET', 'emp:' + id]]; }));
    const map = Object.fromEntries(want.map((m, n) => [m, { date: m.split('|')[0], name: JSON.parse(got[2 * n + 1] || '{}').name || m.split('|')[1], ph: got[2 * n] || null }]));
    list.forEach(x => { x.match = ['dupOf', 'simTo', 'simWho'].filter(k => x[k]).map(k => ({ kind: k, ...map[x[k]] })); });
  }
  return json(list);
}

export async function onRequestPost({ request, env }) {
  const adm = await gate(request, env, 'ops'); if (adm instanceof Response) return adm;
  const { key, decision, out, action } = await request.json();
  const [d, id] = String(key).split('|');
  // Use this selfie as the person's profile photo (shown next to future selfies).
  if (action === 'ref') {
    const ph = await r1(env, 'GET', `ph:${d}:${id}`);
    if (!ph) return json({ error: 'That selfie is no longer stored.' }, 400);
    await r1(env, 'SET', 'ref:' + id, ph);
    await audit(env, adm, 'Set profile photo', id);
    return json({ ok: true });
  }
  if (!['approved', 'rejected'].includes(decision)) return json({ error: 'Bad decision' }, 400);
  const raw = await r1(env, 'GET', `att:${d}:${id}`);
  if (raw) {
    const a = JSON.parse(raw);
    a.status = decision;
    a.by = adm.name;
    if (decision === 'approved' && /^\d{1,2}:\d{2}$/.test(out || '')) { a.out = out.padStart(5, '0'); a.outBy = 'hr'; a.fl = (a.fl || []).filter(f => f !== 'no_clock_out'); }
    await rp(env, [['SET', `att:${d}:${id}`, JSON.stringify(a)], ['SREM', 'review', key]]);
    await audit(env, adm, decision === 'approved' ? 'Approved clock-in' : 'Rejected clock-in', `${id} · ${d}`);
  } else await r1(env, 'SREM', 'review', key);
  return json({ ok: true });
}
