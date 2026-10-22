import { json, rp, r1, jget, getOffices, addDays, today, normPhone, locsOf, pinHash, gate, audit } from '../../_lib.js';

export async function onRequestGet({ request, env }) {
  const adm = await gate(request, env, 'setup'); if (adm instanceof Response) return adm;
  const [act, arc, offices] = await Promise.all([r1(env, 'SMEMBERS', 'emps'), r1(env, 'SMEMBERS', 'archived'), getOffices(env)]);
  const ids = [...act, ...arc], recs = ids.length ? await rp(env, ids.map(i => ['GET', 'emp:' + i])) : [];
  const row = (id, k) => {
    const e = JSON.parse(recs[k] || '{}');
    return { id, name: e.name || id, login: e.login || '', phone: e.phone || '', loc: locsOf(e.loc).length ? locsOf(e.loc).map(i => offices.find(o => o.id === i)?.name || i).join(', ') : 'Any', pay: e.pay ? (e.pay.type || 'monthly') : '' };
  };
  const by = (a, b) => a.name.localeCompare(b.name);
  return json({ active: act.map((id, k) => row(id, k)).sort(by), archived: arc.map((id, k) => row(id, act.length + k)).sort(by) });
}

export async function onRequestPost({ request, env }) {
  const adm = await gate(request, env, 'setup'); if (adm instanceof Response) return adm;
  const b = await request.json(), id = String(b.id || '');
  const emp = await jget(env, 'emp:' + id);
  if (!emp) return json({ error: 'Employee not found' }, 400);

  if (b.action === 'phone') {
    const p = normPhone(b.phone);
    if (p === null) return json({ error: 'That WhatsApp number looks wrong. Use a number like 0812 3456 7890.' }, 400);
    await r1(env, 'SET', 'emp:' + id, JSON.stringify({ ...emp, phone: p || undefined }));
    await audit(env, adm, 'Changed WhatsApp number', emp.name);
    return json({ ok: true });
  }

  // New PIN (also unlocks someone who typed a wrong PIN 5 times).
  if (b.action === 'pin') {
    const pin = String(b.pin || '').trim();
    if (!/^\d{4}$/.test(pin)) return json({ error: 'The PIN must be 4 digits.' }, 400);
    const { pin: _p, ...e2 } = emp;
    await rp(env, [['SET', 'emp:' + id, JSON.stringify({ ...e2, pinH: await pinHash(env, id, pin) })], ['DEL', 'fail:' + id]]);
    await audit(env, adm, 'Set new PIN', emp.name);
    return json({ ok: true });
  }

  // Remove: cannot sign in, hidden from schedules, Today and payroll. History is kept.
  if (b.action === 'archive') {
    const cmds = [['SET', 'emp:' + id, JSON.stringify({ ...emp, archived: true })], ['SREM', 'emps', id], ['SADD', 'archived', id], ['DEL', 'fail:' + id]];
    if (emp.loginId) cmds.push(['DEL', 'login:' + emp.loginId]);
    await rp(env, cmds);
    await audit(env, adm, 'Removed employee', emp.name);
    return json({ ok: true });
  }

  if (b.action === 'restore') {
    const e2 = { ...emp, archived: false };
    let loginDropped = false;
    if (emp.loginId) {
      const owner = await r1(env, 'GET', 'login:' + emp.loginId);
      if (owner && owner !== id) { delete e2.login; delete e2.loginId; loginDropped = true; }
    }
    const cmds = [['SET', 'emp:' + id, JSON.stringify(e2)], ['SADD', 'emps', id], ['SREM', 'archived', id]];
    if (e2.loginId) cmds.push(['SET', 'login:' + e2.loginId, id]);
    await rp(env, cmds);
    await audit(env, adm, 'Restored employee', emp.name);
    return json({ ok: true, loginDropped });
  }

  // Delete permanently: everything about this person (about 2.5 years back, 60 days ahead).
  if (b.action === 'delete') {
    if (String(b.confirm || '').trim().toLowerCase() !== String(emp.name).trim().toLowerCase()) return json({ error: 'The typed name does not match.' }, 400);
    const t = today(), dates = Array.from({ length: 900 }, (_, i) => addDays(t, 60 - i)), months = [...new Set(dates.map(d => d.slice(0, 7)))];
    const ps = await r1(env, 'SMEMBERS', 'pslips:' + id);
    const keys = ['pslips:' + id, 'ref:' + id, ...ps.map(p => `pslip:${p}:${id}`), 'emp:' + id, 'fail:' + id, 'last:' + id, ...(emp.loginId ? ['login:' + emp.loginId] : []),
      ...dates.flatMap(d => [`sched:${d}:${id}`, `att:${d}:${id}`, `ph:${d}:${id}`, `leave:${d}:${id}`]),
      ...months.flatMap(m => [`ot:${m}:${id}`, `kb:${m}:${id}`, `slip:${m}:${id}`])];
    const cmds = [];
    for (let i = 0; i < keys.length; i += 800) cmds.push(['DEL', ...keys.slice(i, i + 800)]);
    cmds.push(['SREM', 'review', ...dates.map(d => `${d}|${id}`)], ['SREM', 'emps', id], ['SREM', 'archived', id]);
    await rp(env, cmds);
    await audit(env, adm, 'Deleted employee permanently', emp.name);
    return json({ ok: true });
  }
  return json({ error: 'Bad request' }, 400);
}
