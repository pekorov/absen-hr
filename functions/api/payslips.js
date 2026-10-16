import { json, rp, r1, jset, auth } from '../_lib.js';
import { releaseAt, monthOf, prevMonths, loadMonth } from '../_payroll.js';

export async function onRequestGet({ request, env }) {
  const u = await auth(request, env);
  if (!u) return json({ error: 'Wrong name or PIN' }, 401);
  const now = Date.now(), months = prevMonths(monthOf(now), 13);
  const released = months.filter(ym => releaseAt(ym) <= now);
  const vals = released.length ? await rp(env, released.map(ym => ['GET', `slip:${ym}:${u.id}`])) : [];
  const slips = vals.filter(Boolean).map(v => JSON.parse(v));
  // Latest released month with no finalized payslip: build it now so nobody is left waiting.
  if (released.length && !vals[0] && u.pay && u.pay.freq !== 'weekly') {
    const [r] = await loadMonth(env, released[0], [u]);
    if (!r.slip.skip) {
      const slip = { ...r.slip, id: u.id, at: new Date().toISOString(), auto: true };
      await jset(env, `slip:${released[0]}:${u.id}`, slip);
      slips.unshift(slip);
    }
  }
  slips.forEach(s => { s.key = s.key || s.month; });
  // Period payslips (weekly pay, or month so far) are shown as soon as HR creates them.
  const tags = (await r1(env, 'SMEMBERS', 'pslips:' + u.id)).sort((a, b) => b.split('_')[1].localeCompare(a.split('_')[1])).slice(0, 30);
  if (tags.length) (await rp(env, tags.map(t => ['GET', `pslip:${t}:${u.id}`]))).filter(Boolean).forEach(v => slips.push(JSON.parse(v)));
  slips.sort((a, b) => (b.to || b.month + '-31').localeCompare(a.to || a.month + '-31'));
  const next = u.pay && u.pay.freq === 'weekly' ? null : months.find(ym => releaseAt(ym) > now);
  return json({ slips, next: next ? { month: next, at: releaseAt(next) } : null });
}
