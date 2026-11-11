#!/usr/bin/env node
// check.mjs: the hidden check for the Mock Service Worker bug "resetHandlers() doesn't restart the generator".
// Run it in a copy of the repo after the agent has finished:   node /path/to/example/msw/check.mjs
// It builds the library, puts the repo's own reset and handler tests back the way they were, copies in a test the
// agent never saw, and runs both. One line per test, then `pass: ...` or `fail: ...`; exit code 0 means pass.
//
// The hidden test asks two things. The bug report asks for the first: after resetHandlers() a generator starts
// again from the top (3 tests). The report never mentions the second: the generator that was cut off has to be
// closed, so the user's `finally` block runs (4 tests). A fix that only drops the old generator passes the first
// three and fails here.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const repo = process.cwd();
const HIDDEN = 'test/node/hidden-check/generator-reset.test.ts';
const NODE_CONFIG = 'test/node/vitest.config.ts';
const env = { ...process.env, CI: '1' };
const run = (cmd, args) => spawnSync(cmd, args, { cwd: repo, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const fail = why => { console.log(`fail: ${why}`); process.exit(1); };

if (!existsSync(path.join(repo, 'node_modules', '.bin', 'vitest'))) fail('run this inside the msw copy (see README.md): node_modules/.bin/vitest is missing');

// 1. the library as the agent left it
const build = run('npx', ['--yes', 'pnpm@9.15.0', 'build']);
if (build.status !== 0) {
  console.log((build.stdout + build.stderr).split('\n').slice(-15).join('\n'));
  fail('pnpm build failed');
}

// 2. the repo's own tests as they were before the agent (it may edit them; its new test files stay)
const regress = readFileSync(path.join(HERE, 'regress.txt'), 'utf8').split('\n').map(l => l.trim().split(/\s+/)).filter(r => r.length === 2);
for (const [, file] of regress) run('git', ['checkout', 'HEAD', '--', file]);

// 3. the hidden test goes in, runs, and comes out again
function vitest(files, config) {
  const out = path.join(mkdtempSync(path.join(tmpdir(), 'msw-check-')), 'out.json');
  run(path.join(repo, 'node_modules', '.bin', 'vitest'), ['run', ...(config ? [`--config=${config}`] : []), ...files, '--reporter=json', `--outputFile=${out}`]);
  let data = {};
  try { data = JSON.parse(readFileSync(out, 'utf8')); } catch { /* vitest wrote nothing: counted below */ }
  const rows = [];
  for (const f of data.testResults ?? []) {
    for (const a of f.assertionResults ?? []) rows.push([[...(a.ancestorTitles ?? []), a.title].join(' > '), a.status === 'passed']);
    if (!(f.assertionResults ?? []).length && f.status === 'failed') rows.push([`${path.relative(repo, f.name)} (the file didn't load)`, false]);
  }
  return rows;
}
mkdirSync(path.join(repo, path.dirname(HIDDEN)), { recursive: true });
cpSync(path.join(HERE, 'generator-reset.hidden.test.ts'), path.join(repo, HIDDEN));
let hidden, own;
try {
  hidden = vitest([HIDDEN], NODE_CONFIG);
  own = [...vitest(regress.filter(r => r[0] === 'node').map(r => r[1]), NODE_CONFIG), ...vitest(regress.filter(r => r[0] === 'unit').map(r => r[1]))];
} finally {
  rmSync(path.join(repo, path.dirname(HIDDEN)), { recursive: true, force: true });
}

console.log('== hidden test');
for (const [title, ok] of hidden) console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${title}`);
const ownFailed = own.filter(r => !r[1]);
console.log(`== the repo's own reset and handler tests: ${own.length - ownFailed.length} of ${own.length} ok`);
for (const [title] of ownFailed.slice(0, 10)) console.log(`  FAIL ${title}`);

const restart = hidden.filter(r => r[0].includes('restart'));
const cleanup = hidden.filter(r => r[0].includes('cleanup'));
const okAll = rows => rows.length > 0 && rows.every(r => r[1]);
console.log(`restart ${okAll(restart) ? 'ok' : 'FAIL'} (${restart.filter(r => r[1]).length} of ${restart.length}), cleanup ${okAll(cleanup) ? 'ok' : 'FAIL'} (${cleanup.filter(r => r[1]).length} of ${cleanup.length})`);
if (hidden.length !== 7) fail(`the hidden test ran ${hidden.length} of 7 tests`);
if (own.length < 100) fail(`the repo's own tests ran ${own.length} of 100`);
const bad = hidden.filter(r => !r[1]).map(r => r[0].split(' > ').pop());
const part = (name, rows) => `${name} ${okAll(rows) ? 'ok' : 'FAIL'} (${rows.filter(r => r[1]).length} of ${rows.length})`;
if (bad.length) fail(`${part('restart', restart)}, ${part('cleanup', cleanup)}`);
if (ownFailed.length) fail(`${ownFailed.length} of the repo's own tests fail now: ${ownFailed[0][0]}`);
console.log('pass: 7 of 7 hidden tests, and the repo\'s own tests still pass');
