import { json, rp, r1, jget, jset, isAdmin, noAdmin } from '../../_lib.js';
import { validMonth, monthEnded, loadMonth, allEmployees, lateRule } from '../../_payroll.js';

export async function onRequestGet({ request, env }) {
  if (!isAdmin(request, env)) return noAdmin();
  const ym = new URL(request.url).searchParams.get('month');
  if (!validMonth(ym)) return json({ error: 'Pick a month' }, 400);
  const [out, run, settings, review] = await Promise.all([
    allEmployees(env).then(e => loadMonth(env, ym, e)), jget(env, 'payrun:' + ym), jget(env, 'paysettings'), r1(env, 'SMEMBERS', 'review')]);
  const rows = out.map(({ emp, slip }) => slip.skip ? { name: emp.name, skip: slip.skip } : slip).sort((a, b) => a.name.localeCompare(b.name));
  return json({ month: ym, ended: monthEnded(ym), run, settings: lateRule(settings || {}), pending: review.filter(k => k.startsWith(ym)).length, rows });
}

export async function onRequestPost({ request, env }) {
  if (!isAdmin(request, env)) return noAdmin();
  const b = await request.json();
  if (b.action === 'settings') {
    const cur = (await jget(env, 'paysettings')) || {}, next = { ...cur };
    if (b.lateOn !== undefined) next.lateOn = !!b.lateOn;
    for (const k of ['tolerance', 'a1', 'from2', 'a2', 'from3', 'a3', 'otRate']) if (b[k] !== undefined) next[k] = Math.max(0, Math.round(Number(b[k]) || 0));
    await jset(env, 'paysettings', next);
    return json({ ok: true });
  }
  if (b.action !== 'finalize' || !validMonth(b.month)) return json({ error: 'Bad request' }, 400);
  if (!monthEnded(b.month)) return json({ error: 'This month has not finished yet.' }, 400);
  const review = await r1(env, 'SMEMBERS', 'review'), pending = review.filter(k => k.startsWith(b.month)).length;
  if (pending && !b.force) return json({ error: `${pending} clock-in(s) in this month still need review.`, pending }, 400);
  const out = await loadMonth(env, b.month, await allEmployees(env));
  const at = new Date().toISOString(), cmds = [];
  let count = 0;
  for (const { emp, slip } of out) {
    if (slip.skip) continue;
    cmds.push(['SET', `slip:${b.month}:${emp.id}`, JSON.stringify({ ...slip, id: emp.id, at })]);
    count++;
  }
  cmds.push(['SET', `payrun:${b.month}`, JSON.stringify({ at, count })]);
  await rp(env, cmds);
  return json({ ok: true, count });
}
