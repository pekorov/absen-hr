import { json, r1, gate } from '../../_lib.js';

// Activity log (owner and HR): newest first.
export async function onRequestGet({ request, env }) {
  const adm = await gate(request, env, 'setup'); if (adm instanceof Response) return adm;
  const rows = await r1(env, 'LRANGE', 'audit', 0, 199);
  return json({ list: rows.map(r => JSON.parse(r)) });
}
