import { TZ, hm, today, rp, r1, jget } from './_lib.js';

const pad2 = n => String(n).padStart(2, '0');
export const validMonth = ym => /^\d{4}-(0[1-9]|1[0-2])$/.test(ym);
export const monthDays = ym => {
  const [y, m] = ym.split('-').map(Number), n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => `${ym}-${pad2(i + 1)}`);
};
// Payslip for a month is shown from 21:00 (local time) on the 1st of the next month.
export const releaseAt = ym => { const [y, m] = ym.split('-').map(Number); return Date.UTC(y, m, 1, 21 - TZ, 0, 0); };
export const monthOf = ts => new Date(ts + TZ * 36e5).toISOString().slice(0, 7);
export const monthEnded = ym => today() > monthDays(ym).slice(-1)[0];
export const prevMonths = (ym, n) => {
  let [y, m] = ym.split('-').map(Number); const out = [];
  for (let i = 0; i < n; i++) { out.push(`${y}-${pad2(m)}`); m--; if (m === 0) { m = 12; y--; } }
  return out;
};

// Late deduction (per late clock-in), by minutes after the shift starts.
export const lateRule = (s = {}) => ({ on: s.lateOn ?? true, tol: s.tolerance ?? 10, a1: s.a1 ?? 10000, from2: s.from2 ?? 20, a2: s.a2 ?? 20000, from3: s.from3 ?? 30, a3: s.a3 ?? 30000 });
export const lateDeduction = (min, r) => (!r.on || !(min > r.tol)) ? 0 : min >= r.from3 ? r.a3 : min >= r.from2 ? r.a2 : r.a1;
// Overtime is added by HR only (never automatic): hours x a fixed rate per hour.
export const otRule = (s = {}) => ({ rate: s.otRate ?? 10000 });
export const normPay = p => p && (p.type ? p : p.base ? { type: 'monthly', rate: p.base } : null);
export const otAmount = (e, rule) => e.override > 0 ? Math.round(e.override) : Math.round(e.hours * rule.rate);
const dots = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// vals = MGET result: the month's schedule codes, then the month's attendance records.
// emp.pay = { type: 'monthly' | 'hourly', rate }  (monthly salary, or pay per hour)
export function calc(emp, ym, days, shifts, settings, vals, todayStr) {
  const pay = normPay(emp.pay);
  if (!pay || !pay.rate) return { skip: 'no_pay_data' };
  const rule = lateRule(settings);
  let sDays = 0, aDays = 0, absent = 0, sHrs = 0, aHrs = 0, pend = 0, unknown = 0, lateDays = 0, late = 0, lateDed = 0, leaveDays = 0, leaveHrs = 0;
  days.forEach((d, i) => {
    const code = vals[i];
    if (!code || code === 'OFF' || d > todayStr) return;
    const sh = shifts[code];
    if (!sh) { unknown++; return; }
    let h = (hm(sh.end) - hm(sh.start)) / 60;
    if (h <= 0) h += 24;
    const a = vals[days.length + i] ? JSON.parse(vals[days.length + i]) : null;
    sDays++; sHrs += h;
    if (a && a.in && a.status !== 'rejected') {
      aDays++; aHrs += h;
      if (a.status === 'review') pend++;
      const dd = lateDeduction(a.late || 0, rule);
      if (dd) { lateDed += dd; lateDays++; late += a.late || 0; }
    } else if (vals[days.length * 2 + 1 + i]) { leaveDays++; leaveHrs += h; aHrs += h; } // paid annual leave
    else absent++;
  });
  if (!sDays) return { skip: 'no_schedule' };
  const R = Math.round, hh = n => Math.round(n * 10) / 10;
  const earnings = [pay.type === 'hourly'
    ? { l: 'Hourly pay', n: `${hh(aHrs)} hours${leaveHrs ? ` (incl. ${hh(leaveHrs)} paid leave)` : ''} x Rp ${dots(pay.rate)}`, a: R(pay.rate * aHrs) }
    : { l: 'Monthly salary', n: `${hh(aHrs)} of ${hh(sHrs)} scheduled hours`, a: R(pay.rate * aHrs / sHrs) }];
  const otList = vals[days.length * 2] ? JSON.parse(vals[days.length * 2]) : [];
  const otHours = otList.reduce((s, e) => s + e.hours, 0), otPay = otList.reduce((s, e) => s + otAmount(e, otRule(settings)), 0);
  if (otPay) earnings.push({ l: 'Overtime', n: `${hh(otHours)} hours`, a: otPay });
  const gross = earnings.reduce((s, x) => s + x.a, 0), ded = Math.min(lateDed, gross);
  const deductions = ded ? [{ l: 'Late deduction', n: `${lateDays} late clock-in${lateDays > 1 ? 's' : ''}`, a: ded }] : [];
  const warn = [];
  if (pend) warn.push(`${pend} clock-in(s) still under review`);
  if (unknown) warn.push(`${unknown} day(s) with an unknown shift code`);
  return { month: ym, name: emp.name, type: pay.type, rate: pay.rate, sDays, aDays, absent, sHrs: hh(sHrs), aHrs: hh(aHrs), leaveDays, late, lateDays, earnings, deductions, gross, ded, net: gross - ded, warn };
}

export async function loadMonth(env, ym, emps) {
  const days = monthDays(ym);
  const [shifts, settings] = await Promise.all([jget(env, 'shifts'), jget(env, 'paysettings')]);
  const keys = id => [...days.map(d => `sched:${d}:${id}`), ...days.map(d => `att:${d}:${id}`), `ot:${ym}:${id}`, ...days.map(d => `leave:${d}:${id}`)];
  const res = emps.length ? await rp(env, emps.map(e => ['MGET', ...keys(e.id)])) : [];
  return emps.map((e, i) => ({ emp: e, slip: calc(e, ym, days, shifts || {}, settings || {}, res[i], today()) }));
}

export async function allEmployees(env) {
  const ids = await r1(env, 'SMEMBERS', 'emps');
  if (!ids.length) return [];
  return (await rp(env, ids.map(i => ['GET', 'emp:' + i]))).map((v, i) => ({ id: ids[i], ...JSON.parse(v || '{}') }));
}
