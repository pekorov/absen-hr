import { json, rp, r1, jget, getOffices, addDays, today, normPhone, isAdmin, noAdmin } from '../../_lib.js';

export async function onRequestGet({ request, env }) {
  if (!isAdmin(request, env)) return noAdmin();
  const [act, arc, offices] = await Promise.all([r1(env, 'SMEMBERS', 'emps'), r1(env, 'SMEMBERS', 'archived'), getOffices(env)]);
  const ids = [...act, ...arc], recs = ids.length ? await rp(env, ids.map(i => ['GET', 'emp:' + i])) : [];
  const row = (id, k) => {
    const e = JSON.parse(recs[k] || '{}');
    return { id, name: e.name || id, login: e.login || '', phone: e.phone || '', loc: e.loc ? (offices.find(o => o.id === e.loc)?.name || e.loc) : 'Any', pay: e.pay ? (e.pay.type || 'monthly') : '' };
  };
  const by = (a, b) => a.name.localeCompare(b.name);
  return json({ active: act.map((id, k) => row(id, k)).sort(by), archived: arc.map((id, k) => row(id, act.length + k)).sort(by) });
}

export async function onRequestPost({ request, env }) {
  if (!isAdmin(request, env)) return noAdmin();
  const b = await request.json(), id = String(b.id || '');
  const emp = await jget(env, 'emp:' + id);
  if (!emp) return json({ error: 'Employee not found' }, 400);

  if (b.action === 'phone') {
    const p = normPhone(b.phone);
    if (p === null) return json({ error: 'That WhatsApp number looks wrong. Use a number like 0812 3456 7890.' }, 400);
    await r1(env, 'SET', 'emp:' + id, JSON.stringify({ ...emp, phone: p || undefined }));
    return json({ ok: true });
  }

  // Remove: cannot sign in, hidden from schedules, Today and payroll. History is kept.
  if (b.action === 'archive') {
    const cmds = [['SET', 'emp:' + id, JSON.stringify({ ...emp, archived: true })], ['SREM', 'emps', id], ['SADD', 'archived', id], ['DEL', 'fail:' + id]];
    if (emp.loginId) cmds.push(['DEL', 'login:' + emp.loginId]);
    await rp(env, cmds);
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
    return json({ ok: true, loginDropped });
  }

  // Delete permanently: everything about this person (about 2.5 years back, 60 days ahead).
  if (b.action === 'delete') {
    if (String(b.confirm || '').trim().toLowerCase() !== String(emp.name).trim().toLowerCase()) return json({ error: 'The typed name does not match.' }, 400);
    const t = today(), dates = Array.from({ length: 900 }, (_, i) => addDays(t, 60 - i)), months = [...new Set(dates.map(d => d.slice(0, 7)))];
    const ps = await r1(env, 'SMEMBERS', 'pslips:' + id);
    const keys = ['pslips:' + id, ...ps.map(p => `pslip:${p}:${id}`), 'emp:' + id, 'fail:' + id, 'last:' + id, ...(emp.loginId ? ['login:' + emp.loginId] : []),
      ...dates.flatMap(d => [`sched:${d}:${id}`, `att:${d}:${id}`, `ph:${d}:${id}`, `leave:${d}:${id}`]),
      ...months.flatMap(m => [`ot:${m}:${id}`, `slip:${m}:${id}`])];
    const cmds = [];
    for (let i = 0; i < keys.length; i += 800) cmds.push(['DEL', ...keys.slice(i, i + 800)]);
    cmds.push(['SREM', 'review', ...dates.map(d => `${d}|${id}`)], ['SREM', 'emps', id], ['SREM', 'archived', id]);
    await rp(env, cmds);
    return json({ ok: true });
  }
  return json({ error: 'Bad request' }, 400);
}
