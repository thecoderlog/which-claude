#!/usr/bin/env node
// bigorders.mjs: the big-order check from week 22.
//   node bigorders.mjs <c3|c4|c6>
// Runs inside a run's copy of the till after the agent has finished. It prints four big carts
// (big/: a party order, a café restock, 300 items, 200 rows of one item) and compares the TOTAL and
// VAT lines with the reference till. Each receipt must be right and take 2 seconds or less.
// The c3 and c4 specs never say how big a basket can be; c6's docs/speed.md does.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const VARIANT = process.argv[2];
const FEATURES = { c3: 'we', c4: 'wev', c5: 'wevs', c6: 'wevsp' }[VARIANT];
if (!FEATURES) { console.error('usage: node bigorders.mjs <c3|c4|c6>'); process.exit(2); }
const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIMIT_MS = 2000;
const totals = text => (text ?? '').split('\n').map(l => l.trimEnd())
  .filter(l => /^(TOTAL|REFUND DUE|incl\. VAT)/.test(l)).join(' | ');

let failed = 0;
for (const name of readdirSync(path.join(HERE, 'big')).sort()) {
  const cart = path.join(HERE, 'big', name);
  const want = totals(spawnSync('node', [path.join(HERE, 'ref', 'till-ref.mjs'), FEATURES,
    path.join(HERE, 'ref', 'offers-s2.json'), cart], { encoding: 'utf8' }).stdout);
  const t = Date.now();
  const p = spawnSync('node', ['src/cli.js', cart], { encoding: 'utf8', timeout: 10_000 });
  const ms = Date.now() - t;
  const got = totals(p.stdout);
  const ok = !p.error && got === want && ms <= LIMIT_MS;
  if (!ok) failed++;
  const how = p.error ? 'still running after 10 s' : got !== want ? `got "${got}", want "${want}"` : `${(ms / 1000).toFixed(2)} s`;
  console.log(`${ok ? '✓' : '✗'} ${name.replace('.csv', '')}: ${how}`);
}
console.log(failed ? `fail: ${failed} of 4 big orders` : 'pass: 4 of 4 big orders');
process.exit(failed ? 1 : 0);
