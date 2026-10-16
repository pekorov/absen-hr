import { json, rp, jset, auth } from '../_lib.js';
import { releaseAt, monthOf, prevMonths, loadMonth } from '../_payroll.js';

export async function onRequestGet({ request, env }) {
  const u = await auth(request, env);
  if (!u) return json({ error: 'Wrong name or PIN' }, 401);
  const now = Date.now(), months = prevMonths(monthOf(now), 13);
  const released = months.filter(ym => releaseAt(ym) <= now);
  const vals = released.length ? await rp(env, released.map(ym => ['GET', `slip:${ym}:${u.id}`])) : [];
  const slips = vals.filter(Boolean).map(v => JSON.parse(v));
  // Latest released month with no finalized payslip: build it now so nobody is left waiting.
  if (released.length && !vals[0] && u.pay) {
    const [r] = await loadMonth(env, released[0], [u]);
    if (!r.slip.skip) {
      const slip = { ...r.slip, id: u.id, at: new Date().toISOString(), auto: true };
      await jset(env, `slip:${released[0]}:${u.id}`, slip);
      slips.unshift(slip);
    }
  }
  const next = months.find(ym => releaseAt(ym) > now);
  return json({ slips, next: next ? { month: next, at: releaseAt(next) } : null });
}
