import { rp, jget, today, nowMin, hm, addDays, daysBetween, sharePlace, swapRules } from './_lib.js';

// Shift swaps between two employees.
//   give  : A gives their shift on dA to B (B is off that day). A becomes OFF.
//   same  : A and B both work on dA and exchange shifts.
//   trade : A gives dA to B, and takes B's shift on dB (A is off on dB, B is off on dA).
// Status: waiting (for B) -> accepted (waiting for admin) -> approved, or declined / rejected / cancelled.
export const isOff = c => !c || c === 'OFF';
export const kindOf = (dA, dB) => (!dB ? 'give' : dB === dA ? 'same' : 'trade');
export const showName = e => String(e.login || e.name || '').trim();

// Reads everything the swap touches. Returns an error message, or null if the swap can go ahead now.
export async function checkSwap(env, s) {
  const dates = [...new Set([s.dA, s.dB].filter(Boolean))];
  const keys = [];
  for (const d of dates) for (const id of [s.a, s.b]) keys.push(`sched:${d}:${id}`, `att:${d}:${id}`, `leave:${d}:${id}`);
  const [vals, A, B, shifts, cfg] = await Promise.all([rp(env, [['MGET', ...keys]]).then(r => r[0]), jget(env, 'emp:' + s.a), jget(env, 'emp:' + s.b), jget(env, 'shifts'), jget(env, 'swapcfg')]);
  const at = (d, id, what) => vals[keys.indexOf(`${what}:${d}:${id}`)];
  if (!A || A.archived || !B || B.archived) return 'One of the two people is no longer active.';
  if (!sharePlace(A, B)) return `${showName(B)} does not work at the same place.`;
  const t = today(), rule = swapRules(cfg), sh = shifts || {};
  for (const d of dates) {
    if (d < t || daysBetween(t, d) > 31) return 'Pick a day within the next 31 days.';
    for (const id of [s.a, s.b]) {
      if (at(d, id, 'att')) return `Someone has already clocked in on ${d}.`;
      if (at(d, id, 'leave')) return `Someone is on annual leave on ${d}.`;
    }
  }
  const cur = (d, id) => at(d, id, 'sched') || 'OFF';
  if (cur(s.dA, s.a) !== s.cA) return 'The schedule changed since this request was made.';
  if (s.kind === 'same') { if (cur(s.dA, s.b) !== s.cB) return 'The schedule changed since this request was made.'; }
  else if (!isOff(cur(s.dA, s.b))) return `${showName(B)} already has a shift on ${s.dA}.`;
  if (s.kind === 'trade') {
    if (cur(s.dB, s.b) !== s.cB) return 'The schedule changed since this request was made.';
    if (!isOff(cur(s.dB, s.a))) return `${showName(A)} already has a shift on ${s.dB}.`;
  }
  // Every shift involved must start at least <hours> from now.
  for (const [d, c] of [[s.dA, s.cA], [s.dB, s.cB]]) {
    if (!d || isOff(c)) continue;
    if (!sh[c]) return `Unknown shift code ${c}.`;
    const mins = daysBetween(t, d) * 1440 + hm(sh[c].start) - nowMin();
    if (mins < rule.hours * 60) return rule.hours ? `Too late: swaps must be settled at least ${rule.hours} hours before the shift starts.` : 'That shift has already started.';
  }
  return null;
}

export function applyCmds(s) {
  if (s.kind === 'give') return [['SET', `sched:${s.dA}:${s.a}`, 'OFF'], ['SET', `sched:${s.dA}:${s.b}`, s.cA]];
  if (s.kind === 'same') return [['SET', `sched:${s.dA}:${s.a}`, s.cB], ['SET', `sched:${s.dA}:${s.b}`, s.cA]];
  return [['SET', `sched:${s.dA}:${s.a}`, 'OFF'], ['SET', `sched:${s.dA}:${s.b}`, s.cA], ['SET', `sched:${s.dB}:${s.b}`, 'OFF'], ['SET', `sched:${s.dB}:${s.a}`, s.cB]];
}

export const describe = s => s.kind === 'give' ? `${s.aL} gives ${s.cA} on ${s.dA} to ${s.bL}`
  : s.kind === 'same' ? `${s.aL} (${s.cA}) and ${s.bL} (${s.cB}) swap on ${s.dA}`
  : `${s.aL} gives ${s.cA} on ${s.dA} to ${s.bL}; ${s.bL} gives ${s.cB} on ${s.dB} to ${s.aL}`;

// All swaps, newest first. Old finished ones (last day more than 30 days ago) are cleaned up.
export async function allSwaps(env) {
  const raw = await rp(env, [['HGETALL', 'swaps']]).then(r => r[0]), list = [], old = [], cut = addDays(today(), -30);
  for (let i = 0; i < raw.length; i += 2) {
    const s = JSON.parse(raw[i + 1]);
    if ((s.dB && s.dB > s.dA ? s.dB : s.dA) < cut) old.push(raw[i]); else list.push(s);
  }
  if (old.length) await rp(env, [['HDEL', 'swaps', ...old]]);
  return list.sort((x, y) => y.at - x.at);
}
