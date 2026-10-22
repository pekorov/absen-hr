import { json, rp, jget } from '../_lib.js';
import { loadMonth, loadPeriod, slipFp } from '../_payroll.js';

// Private payslip link (from the WhatsApp message): /slip?k=<code>.
// Works only while the payslip is verified and unchanged, and for 45 days.
const nope = (msg, s = 404) => new Response(JSON.stringify({ error: msg }), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export async function onRequestGet({ request, env }) {
  const code = new URL(request.url).searchParams.get('k') || '';
  if (!/^[a-f0-9]{40}$/.test(code)) return nope('Link tidak valid.');
  const sh = await jget(env, 'share:' + code);
  if (!sh) return nope('Link ini sudah kedaluwarsa atau tidak berlaku lagi. Silakan minta link baru ke HR.');
  const [sv, emp] = await rp(env, [['GET', sh.k], ['GET', 'emp:' + sh.k.split(':').pop()]]).then(r => r.map(v => (v ? JSON.parse(v) : null)));
  if (!sv || !sv.ver || sv.share !== code || !emp) return nope('Link ini sudah tidak berlaku. Silakan minta link baru ke HR.');
  // Has anything changed since HR verified it? Then this link stops working until HR verifies again.
  const e = { id: sv.id, ...emp };
  const live = sh.k.startsWith('pslip:')
    ? (await loadPeriod(env, sv.from, sv.to, [e]))[0].slip
    : (await loadMonth(env, sv.month, [e]))[0].slip;
  if (live.skip || slipFp(live) !== slipFp(sv)) return nope('Slip gaji ini sedang diperbarui oleh HR. Silakan tunggu link yang baru.', 410);
  const pick = ['name', 'type', 'month', 'from', 'to', 'earnings', 'deductions', 'net', 'aDays', 'sDays', 'leaveDays', 'lateDays', 'ver', 'shareUntil', 'key'];
  return new Response(JSON.stringify(Object.fromEntries(pick.map(k => [k, sv[k]]))), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
}
