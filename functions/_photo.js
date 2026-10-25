import { rp, sha } from './_lib.js';

// Duplicate-selfie checks at clock-in. They only flag the clock-in for Review; nobody is blocked.
//  same_photo     : exactly the same image was sent before (by anyone) - a re-sent / tampered photo
//  similar_photo  : almost identical to one of this person's last 30 selfies (e.g. a picture held up to the camera)
//  similar_other  : almost identical to someone else's selfie today (one photo used for two people)
// "Look-alike" uses a small visual fingerprint (16x16 difference hash, 256 bits) made on the phone.
export const SIM_BITS = 10; // up to this many of 256 bits different = "almost identical"
const KEEP = 5184000; // 60 days, same as the selfies
const bits = h => { let n = 0; for (const c of h) { let v = parseInt(c, 16); while (v) { n += v & 1; v >>= 1; } } return n; };
export const hamming = (a, b) => { if (!a || !b || a.length !== b.length) return 999; let n = 0; for (let i = 0; i < a.length; i += 8) n += bits(((parseInt(a.slice(i, i + 8), 16) ^ parseInt(b.slice(i, i + 8), 16)) >>> 0).toString(16)); return n; };
export const validVh = v => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);

export async function photoChecks(env, id, date, photo, vh) {
  const flags = [], info = {}, cmds = [];
  if (!photo) return { flags, info, cmds };
  const h = await sha(photo), ok = validVh(vh);
  const [prev, mine, day] = await rp(env, [['GET', 'phash:' + h], ['LRANGE', 'vh:' + id, 0, 29], ['LRANGE', 'vhday:' + date, 0, 199]]);
  if (prev && prev !== `${date}|${id}`) { flags.push('same_photo'); info.dupOf = prev; }
  cmds.push(['SET', 'phash:' + h, `${date}|${id}`, 'EX', KEEP, 'NX']);
  if (ok) {
    if (!info.dupOf) {
      const hit = mine.map(x => x.split('|')).find(([d, v]) => d !== date && hamming(v, vh) <= SIM_BITS);
      if (hit) { flags.push('similar_photo'); info.simTo = `${hit[0]}|${id}`; }
      const other = day.map(x => x.split('|')).find(([who, v]) => who !== id && hamming(v, vh) <= SIM_BITS);
      if (other) { flags.push('similar_other'); info.simWho = `${date}|${other[0]}`; }
    }
    cmds.push(['LPUSH', 'vh:' + id, `${date}|${vh}`], ['LTRIM', 'vh:' + id, 0, 29], ['LPUSH', 'vhday:' + date, `${id}|${vh}`], ['EXPIRE', 'vhday:' + date, 172800]);
  }
  return { flags, info, cmds };
}
