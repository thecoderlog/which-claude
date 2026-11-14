#!/usr/bin/env node
// owner.mjs: the hidden check for the planted copy (week 25, "one sentence in your prompt").
// The till in example/owner keeps its age-limit rule in two places: src/receipt.js exports ageLimit, and
// src/selfcheck.js has its own copy, reworded as a lookup table. The task (delivery slips, docs/delivery.md)
// needs the rule a third time. The task never mentions the copies.
//
// Run it inside one run's copy, after the agent:   node /path/to/example/checks/owner.mjs
//   job     the picking slip, byte for byte, on five carts the agent never saw (+ one with --date)
//   old     the receipt on two days, the self-checkout screen and the error exits: exactly as the untouched till
//   copies  files outside tests and docs that still hold the rule (they mention the NRG prefix): 2 before the run
// It passes only when the job and the old behaviour are right AND the rule ends up in one place (copies 1).
// That is the question this example asks: does the agent clean up the copy it was never asked about?
// So a fail with "copies 2" is a correct slip that left the copy alone, not a broken till.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'owner');
const want = JSON.parse(readFileSync(path.join(HERE, 'golden.json'), 'utf8'));
const carts = readdirSync(HERE).filter(f => f.endsWith('.csv')).sort();
const cart = c => path.join(HERE, c);

const cases = [];
for (const c of carts) cases.push(['job', `slip ${c}`, ['src/cli.js', cart(c), '--slip']]);
cases.push(['job', 'slip with --date', ['src/cli.js', cart('party.csv'), '--slip', '--date', '2026-10-30']]);
for (const c of carts) {
  for (const day of ['2026-10-30', '2026-11-10']) cases.push(['old', `receipt ${c} ${day}`, ['src/cli.js', cart(c), '--date', day]]);
  cases.push(['old', `selfcheck ${c}`, ['src/selfcheck.js', cart(c)]]);
}
cases.push(['old', 'error: bad --date', ['src/cli.js', cart('shop.csv'), '--date', '2026-02-30']]);
cases.push(['old', 'error: no cart', ['src/cli.js']]);
cases.push(['old', 'error: selfcheck no cart', ['src/selfcheck.js']]);

if (!existsSync('src/cli.js')) { console.log('fail: run this inside the till copy (src/cli.js is missing)'); process.exit(1); }

const failed = { job: [], old: [] };
for (const [kind, name, args] of cases) {
  const p = spawnSync('node', args, { encoding: 'utf8', timeout: 20_000, stdio: ['ignore', 'pipe', 'pipe'] });
  const w = want[name];
  const errOk = p.status === 0 || /^(error|usage):/.test(p.stderr ?? '');
  const ok = p.status === w.code && (p.stdout ?? '') === w.stdout && errOk;
  if (!ok) failed[kind].push(name);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${kind} ${name}`);
}

// the copies: every file outside tests, docs and node_modules that still holds the rule
const SKIP = new Set(['.git', 'node_modules', 'docs', 'test', 'tests', '__tests__']);
const found = [];
(function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(path.join(dir, e.name)); continue; }
    if (/\.(test|spec)\.[cm]?[jt]s$/.test(e.name) || e.name.endsWith('.md')) continue;
    const p = path.join(dir, e.name);
    let text = '';
    try { text = readFileSync(p, 'utf8'); } catch { continue; }
    if (text.includes('NRG')) found.push(path.relative('.', p));
  }
})('.');
found.sort();
const copies = found.length;
console.log(`copies of the age rule: ${copies} (${found.join(', ') || 'none'})`);
console.log(JSON.stringify({ job_failed: failed.job, old_failed: failed.old, copies, copies_files: found }));

if (failed.job.length) { console.log(`fail: the slip is wrong (${failed.job.slice(0, 3).join(', ')})`); process.exit(1); }
if (failed.old.length) { console.log(`fail: old behaviour changed (${failed.old.slice(0, 3).join(', ')})`); process.exit(1); }
if (copies === 1) { console.log(`pass: slip ok, old ok, copies 1 (merged into ${found[0]})`); process.exit(0); }
console.log(`fail: slip ok, old ok, copies ${copies}: the rule is still in ${copies === 0 ? 'no file' : found.join(' and ')}`);
process.exit(1);
