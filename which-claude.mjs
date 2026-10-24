#!/usr/bin/env node
// which-claude: run your own coding task on each Claude model, check every result with your own
// command, and see how often each one passed, how long it took and what it really cost.
import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { agent } from './agent.mjs';
import { MODELS, PRICES_CHECKED, costOf, displayName, modelId } from './prices.mjs';

const VERSION = '0.1.0';
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
// Errors that the next run would hit too: stop instead of paying for them
const FATAL = ['authentication_failed', 'billing_error', 'account_on_hold', 'verification_required', 'model_not_found',
  'oauth_org_not_allowed', 'cloud_credential_error', 'invalid_request'];
// Errors from the API side (after Claude Code's own retries): the run doesn't count either way
const API_FAILED = [...FATAL, 'rate_limit', 'overloaded', 'server_error', 'unknown'];
// Runs that count: the check decided them
const FINISHED = ['pass', 'fail', 'timeout', 'budget'];
// How each state of a run shows in the table: mark, colour
const MARK = {
  waiting: ['·', '2'], setup: ['…', '33'], running: ['●', '33'], checking: ['◌', '33'], pass: ['✓', '32'], fail: ['✗', '31'],
  timeout: ['✗', '31'], budget: ['✗', '31'], error: ['!', '31'], stopped: ['!', '31'], skipped: ['–', '2'],
};

const HELP = `which-claude ${VERSION}: run your coding task on each Claude model and compare them.

  which-claude "<task>" --check "<command>" [options]

Each run gets a fresh copy of this folder. The agent works on the task in the copy, then your
check command runs there: exit code 0 means the run passed.

  --check <command>     decides pass or fail, in each copy after the agent (required)
  --models <list>       sonnet, opus, haiku, fable or model ids, comma-separated; add :effort to
                        one model, like opus:high (default: sonnet,opus)
  --runs <n>            runs per model (default: 3)
  --effort <level>      low, medium, high, xhigh or max for every model (default: each model's own)
  --max-dollars <usd>   stop once the runs have cost this much (default: 5)
  --timeout <minutes>   give up on a run after this long (default: 15)
  --setup <command>     run in each copy before the agent starts, like "npm ci" (not timed or billed)
  --out <folder>        where result.json, transcripts and diffs go (default: a new temp folder)
  --keep                keep the copies (default: each copy is deleted after its check)

Needs ANTHROPIC_API_KEY. Every run is billed to that key; the cost of each run is shown.`;

// ------------------------------------------------------------------ options
let opts, positionals;
try {
  ({ values: opts, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      check: { type: 'string' }, models: { type: 'string', default: 'sonnet,opus' }, runs: { type: 'string', default: '3' },
      effort: { type: 'string' }, 'max-dollars': { type: 'string', default: '5' }, timeout: { type: 'string', default: '15' },
      setup: { type: 'string' }, out: { type: 'string' }, keep: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' }, version: { type: 'boolean' },
    },
  }));
} catch (e) {
  usage(e.message);
}
if (opts.help) { console.log(HELP); process.exit(0); }
if (opts.version) { console.log(VERSION); process.exit(0); }

const task = positionals.join(' ').trim();
if (!task) usage('say what the task is, in quotes');
if (!opts.check) usage('--check is missing: the command that says whether a run passed (exit code 0)');
const RUNS = whole(opts.runs, '--runs');
const MAX = Number(opts['max-dollars']);
if (!(MAX > 0)) usage('--max-dollars must be a number above 0');
const TIMEOUT_MS = Number(opts.timeout) * 60_000;
if (!(TIMEOUT_MS > 0)) usage('--timeout must be a number of minutes');
if (opts.effort && !EFFORTS.includes(opts.effort)) usage(`--effort must be one of ${EFFORTS.join(', ')}`);
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('which-claude needs an API key: set ANTHROPIC_API_KEY (Claude Console > API keys). Every run is billed to it.');
  process.exit(2);
}

const lanes = opts.models.split(',').map(s => s.trim()).filter(Boolean).map((spec, i) => {
  const [name, effort = opts.effort] = spec.split(':');
  if (effort && !EFFORTS.includes(effort)) usage(`"${spec}": effort must be one of ${EFFORTS.join(', ')}`);
  const model = modelId(name);
  return { i, model, effort: effort || null, name: displayName(model), applied: null };
});
if (!lanes.length) usage('--models is empty');
for (const l of lanes) {
  const same = lanes.filter(x => x.name === l.name && x.effort === l.effort);
  if (same.length > 1) l.name += ` #${same.indexOf(l) + 1}`;
}

const cwd = process.cwd();
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
const base = path.join(tmpdir(), `which-claude-${stamp}`);
const out = path.resolve(opts.out ?? base);
mkdirSync(path.join(out, 'transcripts'), { recursive: true });
mkdirSync(path.join(out, 'diffs'), { recursive: true });

const sdkVersion = (() => {
  try {
    const sdk = createRequire(import.meta.url).resolve('@anthropic-ai/claude-agent-sdk');
    return JSON.parse(readFileSync(path.join(path.dirname(sdk), 'package.json'), 'utf8')).version;
  } catch { return 'unknown'; }
})();
const info = {
  which_claude: VERSION, agent_sdk: sdkVersion, claude_code: null, node: process.version, platform: process.platform,
  started: new Date().toISOString(), finished: null, task, check: opts.check, setup: opts.setup ?? null, folder: cwd,
  runs_per_model: RUNS, max_dollars: MAX, timeout_minutes: Number(opts.timeout), effort: opts.effort ?? null,
  order: 'one run at a time; the models take turns, and the order flips every round', prices_checked: PRICES_CHECKED,
  stopped: null,
};

// Every run, in the order they happen: round 1 in the order given, round 2 the other way round, ...
const runs = [];
for (let n = 1; n <= RUNS; n++) {
  for (const lane of n % 2 ? lanes : [...lanes].reverse()) {
    runs.push({ seq: runs.length + 1, lane: lane.i, model: lane.model, effort: lane.effort, n, status: 'waiting' });
  }
}

// ------------------------------------------------------------------ the runs
let current = null;
let interrupted = false;
process.on('SIGINT', () => {
  if (interrupted) process.exit(130);
  interrupted = true;
  current?.ac.abort();
});

const tty = Boolean(process.stdout.isTTY);
const color = tty && !process.env.NO_COLOR;
let drawn = 0; // lines of the live table on screen, redrawn in place
printHeader();
const ticker = tty ? setInterval(draw, 500) : null;
draw();

for (const r of runs) {
  if (interrupted) break;
  if (spent() >= MAX) {
    info.stopped = `the runs cost ${usd(spent())}, the cap is ${usd(MAX)} (--max-dollars)`;
    break;
  }
  try {
    await runOne(r);
  } catch (e) {
    Object.assign(r, { status: 'error', fatal: true, crash: String(e?.message ?? e).slice(0, 500) });
  }
  save();
  if (!tty) printRun(r);
  if (r.status === 'error' && r.fatal) {
    info.stopped = `run ${r.seq}: ${r.api_error ? `API error (${r.api_error})` : r.crash ?? 'error'}`;
    break;
  }
}
for (const r of runs) if (r.status === 'waiting') r.status = 'skipped';
if (interrupted) info.stopped ??= 'stopped with Ctrl-C';
info.finished = new Date().toISOString();
if (ticker) clearInterval(ticker);
draw(true);
save();
printScoreboard();
if (!opts.keep) for (const r of runs) if (r.dir) rmSync(path.dirname(r.dir), { recursive: true, force: true, maxRetries: 3 });
process.stdout.write('', () => process.exit(interrupted ? 130 : info.stopped ? 1 : 0));

async function runOne(r) {
  const lane = lanes[r.lane];
  const tag = `run-${String(r.seq).padStart(2, '0')}`;
  const dir = path.join(base, tag, path.basename(cwd));
  r.dir = dir;
  mkdirSync(path.dirname(dir), { recursive: true });
  cpSync(cwd, dir, { recursive: true, verbatimSymlinks: true, filter: src => !inside(src, base) && !inside(src, out) });
  const head = git(dir, 'rev-parse', 'HEAD').trim() || null;
  if (opts.setup) {
    r.status = 'setup';
    const s = await sh(opts.setup, dir, TIMEOUT_MS);
    writeFileSync(path.join(out, 'transcripts', `${tag}.setup.txt`), s.out);
    if (s.code !== 0) {
      r.status = 'error';
      r.crash = `--setup exited with ${s.code}`;
      return;
    }
  }

  r.status = 'running';
  r.started = new Date().toISOString();
  r.t0 = Date.now();
  r.events = [];
  r.cost_curve = [];
  r.now = 'starting';
  const transcript = path.join(out, 'transcripts', `${tag}.jsonl`);
  const ac = new AbortController();
  current = { r, ac };
  const timer = setTimeout(() => { r.timed_out = true; ac.abort(); }, TIMEOUT_MS);
  const usageById = new Map();
  try {
    const messages = agent({
      task, model: lane.model, effort: lane.effort ?? undefined, cwd: dir, abortController: ac,
      maxBudgetUsd: Math.max(0.01, MAX - spent()),
      env: { ...process.env, CLAUDE_AGENT_SDK_CLIENT_APP: `which-claude/${VERSION}` },
      stderr: data => appendFileSync(path.join(out, 'transcripts', `${tag}.stderr.txt`), data),
      onEffort: level => {
        if (!level) return;
        r.effort_applied = level;
        lane.applied ??= level;
      },
    });
    let replyId = null;
    for await (const msg of messages) {
      const t = Date.now() - r.t0;
      if (msg.type === 'stream_event') {
        const ev = msg.event;
        if (ev.type === 'message_start') usageById.set(replyId = ev.message.id, { ...ev.message.usage });
        if (ev.type === 'message_delta' && usageById.has(replyId)) {
          for (const [k, v] of Object.entries(ev.usage ?? {})) if (v != null) usageById.get(replyId)[k] = v;
        }
        if (ev.type === 'message_start' || ev.type === 'message_delta') {
          r.running_usd = [...usageById.values()].reduce((s, u) => s + (costOf(lane.model, u) ?? 0), 0);
          r.cost_curve.push([t, round(r.running_usd, 6)]);
        }
        continue;
      }
      appendFileSync(transcript, JSON.stringify(msg) + '\n');
      if (msg.type === 'system' && msg.subtype === 'init') {
        r.session_id = msg.session_id;
        r.api_key_source = msg.apiKeySource;
        info.claude_code ??= msg.claude_code_version;
      }
      if (msg.type === 'assistant') {
        if (msg.error) r.api_error = msg.error;
        for (const b of msg.message.content ?? []) {
          if (b.type === 'tool_use') {
            r.now = `${b.name}  ${describe(b.input, dir)}`;
            r.events.push({ t, tool: b.name, input: describe(b.input, dir) });
          } else if (b.type === 'text' && b.text.trim()) {
            r.events.push({ t, text: b.text.slice(0, 500) });
          }
        }
      }
      if (msg.type === 'result') {
        r.result = {
          subtype: msg.subtype, is_error: msg.is_error, api_error_status: msg.api_error_status ?? null,
          duration_ms: msg.duration_ms, duration_api_ms: msg.duration_api_ms, num_turns: msg.num_turns,
          total_cost_usd: msg.total_cost_usd, usage: msg.usage, model_usage: msg.modelUsage,
          summary: typeof msg.result === 'string' ? msg.result.slice(0, 2000) : null, errors: msg.errors ?? null,
        };
      }
    }
  } catch (e) {
    if (!ac.signal.aborted) r.crash = String(e?.message ?? e).slice(0, 500);
  } finally {
    clearTimeout(timer);
    current = null;
  }
  r.wall_ms = Date.now() - r.t0;
  r.cost_usd = r.result?.total_cost_usd ?? round(r.running_usd ?? 0, 6);
  r.cost_is_estimate = !r.result;
  r.tokens = tokens(r.result?.model_usage);

  r.fatal = Boolean((r.api_error && FATAL.includes(r.api_error)) || [401, 403].includes(r.result?.api_error_status)
    || (r.crash && !r.result));
  if (interrupted) {
    r.status = 'stopped';
  } else if (r.fatal || (r.api_error && API_FAILED.includes(r.api_error))) {
    r.status = 'error';
  } else {
    r.status = 'checking';
    r.now = `checking: ${opts.check}`;
    const c = await sh(opts.check, dir, TIMEOUT_MS, { ANTHROPIC_API_KEY: undefined });
    const lines = c.out.trim().split('\n').map(l => l.trim()).filter(Boolean);
    r.check = { exit_code: c.code, pass: c.code === 0, ms: c.ms, last_line: lines.at(-1) ?? '', output: c.out.slice(-20_000) };
    r.status = c.code === 0 ? 'pass' : r.timed_out ? 'timeout' : r.result?.subtype === 'error_max_budget_usd' ? 'budget' : 'fail';
  }
  r.diff = diff(dir, head, path.join(out, 'diffs', `${tag}.patch`));
  if (!opts.keep) rmSync(path.dirname(dir), { recursive: true, force: true, maxRetries: 3 });
}

// ------------------------------------------------------------------ numbers
function spent() {
  return runs.reduce((s, r) => s + (r.cost_usd ?? (r.status === 'running' ? r.running_usd ?? 0 : 0)), 0);
}

function tokens(modelUsage) {
  const t = { input: 0, cache_read: 0, cache_write: 0, output: 0, thinking: 0 };
  for (const m of Object.values(modelUsage ?? {})) {
    t.input += m.inputTokens ?? 0;
    t.cache_read += m.cacheReadInputTokens ?? 0;
    t.cache_write += m.cacheCreationInputTokens ?? 0;
    t.output += m.outputTokens ?? 0;
    t.thinking += m.thinkingTokens ?? 0;
  }
  return t;
}

function laneSummary(lane) {
  const mine = runs.filter(r => r.lane === lane.i);
  const done = mine.filter(r => FINISHED.includes(r.status));
  const passed = done.filter(r => r.status === 'pass').length;
  const cost = mine.reduce((s, r) => s + (r.cost_usd ?? 0), 0);
  const sum = k => mine.reduce((s, r) => s + (r.tokens?.[k] ?? 0), 0);
  return {
    model: lane.model, name: lane.name, effort: lane.effort, effort_applied: lane.applied,
    runs: done.length, passed, pass_rate: done.length ? round(passed / done.length, 3) : null,
    median_seconds: median(done.map(r => r.wall_ms / 1000)), median_turns: median(done.map(r => r.result?.num_turns).filter(Number.isFinite)),
    median_output_tokens: median(done.map(r => r.tokens?.output).filter(Number.isFinite)),
    spent_usd: round(cost, 6), cost_per_passing_run: passed ? round(cost / passed, 6) : null,
    tokens: { input: sum('input'), cache_read: sum('cache_read'), cache_write: sum('cache_write'), output: sum('output'), thinking: sum('thinking') },
    list_price_per_mtok: MODELS[lane.model] ? { in: MODELS[lane.model].in, out: MODELS[lane.model].out } : null,
  };
}

function save() {
  const clean = runs.map(({ t0, now, running_usd, ...r }) => r);
  const result = { ...info, spent_usd: round(spent(), 6), lanes: lanes.map(laneSummary), runs: clean };
  writeFileSync(path.join(out, 'result.json'), JSON.stringify(result, null, 2) + '\n');
}

// ------------------------------------------------------------------ the screen
function printHeader() {
  const c = cols();
  console.log(fit(`${paint('1', 'which-claude')} ${VERSION} · Agent SDK ${sdkVersion}`, c));
  wrap(task, c - 8).forEach((line, i) => console.log(`${paint('2', i ? '     ' : 'task ')}  ${line}`));
  console.log(fit(`${paint('2', 'check')}  ${opts.check}`, c));
  console.log(fit(paint('2', `${RUNS} run${RUNS > 1 ? 's' : ''} per model, one at a time, taking turns · stops at ${usd(MAX)}`), c));
  console.log();
}

function draw(final = false) {
  if (!tty && !final) return;
  const c = cols();
  const lines = table(c);
  if (!final) {
    const r = runs.find(x => ['setup', 'running', 'checking'].includes(x.status));
    lines.push('');
    if (r) lines.push(fit(`${paint('2', 'now  ')} ${paint(laneColor(r.lane), lanes[r.lane].name)} run ${r.n} · ${clock(Date.now() - r.t0)} · ${r.now ?? r.status}`, c));
    lines.push(fit(paint('2', `spent ${usd(spent())} of ${usd(MAX)} · ${runs.filter(x => x.wall_ms !== undefined).length} of ${runs.length} runs done`), c));
  }
  let s = drawn ? `\x1b[${drawn}A\r\x1b[J` : '';
  s += lines.join('\n') + '\n';
  process.stdout.write(s);
  drawn = final ? 0 : lines.length;
}

function table(c) {
  const effortText = l => effortOf(l.effort, l.applied);
  const nameW = Math.max(5, ...lanes.map(l => l.name.length));
  const effW = Math.max(6, ...lanes.map(l => effortText(l).length));
  const left = nameW + 2 + effW + 2;
  let style = 'full';
  if (left + RUNS * 14 > c) style = 'short';
  if (left + RUNS * 9 > c) style = 'mark';
  const cellW = { full: 14, short: 9, mark: 3 }[style];
  const head = [pad('model', nameW), pad('effort', effW), ...Array.from({ length: RUNS }, (_, i) => pad(style === 'mark' ? `${i + 1}` : `run ${i + 1}`, cellW - 2))];
  const lines = [fit(paint('2', head.join('  ')), c)];
  for (const l of lanes) {
    const cells = [];
    for (let n = 1; n <= RUNS; n++) cells.push(cell(runs.find(r => r.lane === l.i && r.n === n), style, cellW));
    lines.push(fit(`${paint(laneColor(l.i), pad(l.name, nameW))}  ${paint('2', pad(effortText(l), effW))}  ${cells.join('')}`, c));
  }
  return lines;
}

function cell(r, style, w) {
  const shown = text => paint(MARK[r.status]?.[1] ?? '2', text) + ' '.repeat(Math.max(0, w - text.length));
  const mark = MARK[r.status]?.[0] ?? '·';
  if (style === 'mark' || ['waiting', 'skipped'].includes(r.status)) return shown(mark);
  const ms = r.wall_ms ?? Date.now() - (r.t0 ?? Date.now());
  const cost = r.cost_usd ?? r.running_usd ?? 0;
  if (r.status === 'setup') return shown('… setup');
  return shown(style === 'short' ? `${mark} ${usd(cost)}` : `${mark} ${clock(ms)} ${usd(cost)}`);
}

function printRun(r) {
  const l = lanes[r.lane];
  console.log([`run ${r.seq} of ${runs.length}`, l.name, effortOf(l.effort, r.effort_applied),
    `${MARK[r.status][0]} ${clock(r.wall_ms ?? 0)} ${usd(r.cost_usd ?? 0)}`, `${r.result?.num_turns ?? '?'} turns`,
    r.check?.last_line || r.status].join(' · '));
}

function printScoreboard() {
  const c = cols();
  const rows = lanes.map(laneSummary);
  const head = ['model', 'effort', 'passed', 'time', 'turns', 'tokens out', 'spent', 'per passing run'];
  const body = rows.map(s => [s.name, effortOf(s.effort, s.effort_applied),
    `${s.passed} of ${s.runs}`, s.median_seconds == null ? '-' : clock(s.median_seconds * 1000), s.median_turns ?? '-',
    s.median_output_tokens == null ? '-' : num(s.median_output_tokens), usd(s.spent_usd),
    s.cost_per_passing_run == null ? 'none passed' : usd(s.cost_per_passing_run)]);
  console.log();
  printColumns(head, body, c, rows.map((_, i) => laneColor(i)));
  console.log(fit(paint('2', 'time, turns and tokens out are medians · per passing run = all it spent ÷ the runs that passed'), c));

  console.log();
  const thead = ['tokens, all runs', 'new in', 'cache read', 'cache write', 'out', 'of it thinking', 'spent'];
  printColumns(thead, rows.map(s => [laneLabel(s), num(s.tokens.input), num(s.tokens.cache_read), num(s.tokens.cache_write),
    num(s.tokens.output), num(s.tokens.thinking), usd(s.spent_usd)]), c, rows.map((_, i) => laneColor(i)));

  const bad = runs.filter(r => ['fail', 'timeout', 'budget', 'error', 'stopped'].includes(r.status));
  if (bad.length) {
    console.log();
    for (const r of bad) {
      const why = r.status === 'timeout' ? `stopped after ${opts.timeout} min${r.check ? `; ${r.check.last_line}` : ''}`
        : r.status === 'budget' ? 'stopped at the money cap'
        : r.check ? r.check.last_line || `exit code ${r.check.exit_code}`
        : r.api_error ? `API error (${r.api_error}), not counted` : r.crash ?? r.status;
      console.log(fit(`${paint('31', '✗')} ${laneLabel(lanes[r.lane])} run ${r.n}: ${why}`, c));
    }
  }
  console.log();
  if (info.stopped) console.log(fit(paint('31', `stopped early: ${info.stopped}`), c));
  console.log(fit(`spent ${usd(spent())} in all (the Agent SDK's count; your Console bill is the real one)`, c));
  console.log(`results: ${path.join(out, 'result.json')}`);
}

function printColumns(head, body, c, colors) {
  const w = head.map((h, i) => Math.max(h.length, ...body.map(b => String(b[i]).length)));
  console.log(fit(paint('2', head.map((h, i) => pad(h, w[i])).join('   ').trimEnd()), c));
  body.forEach((b, j) => console.log(fit(b.map((x, i) => (i === 0 ? paint(colors[j], pad(x, w[i])) : pad(String(x), w[i]))).join('   ').trimEnd(), c)));
}

// ------------------------------------------------------------------ small helpers
// A lane's name where the effort column isn't next to it: "Opus 5.5 high"
function laneLabel(l) {
  return l.effort ? `${l.name} ${l.effort}` : l.name;
}

function effortOf(asked, applied) {
  if (!asked) return applied ? `${applied} (default)` : 'default';
  return applied && applied !== asked ? `${asked} → ${applied}` : asked;
}

function usage(msg) {
  console.error(`which-claude: ${msg}\n\n${HELP}`);
  process.exit(2);
}

function whole(v, name) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) usage(`${name} must be a whole number, 1 or more`);
  return n;
}

function sh(command, dir, timeoutMs, envChanges = {}) {
  return new Promise(resolve => {
    const t0 = Date.now();
    const env = { ...process.env, ...envChanges };
    for (const [k, v] of Object.entries(envChanges)) if (v === undefined) delete env[k];
    const p = spawn(command, { cwd: dir, shell: true, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let text = '';
    const add = d => { text = (text + d).slice(-200_000); };
    p.stdout.on('data', add);
    p.stderr.on('data', add);
    const timer = setTimeout(() => {
      text += `\n(which-claude: stopped after ${Math.round(timeoutMs / 60_000)} min)\n`;
      try { process.kill(-p.pid, 'SIGKILL'); } catch { p.kill('SIGKILL'); }
    }, timeoutMs);
    p.on('error', e => { clearTimeout(timer); resolve({ code: -1, out: text + String(e), ms: Date.now() - t0 }); });
    p.on('close', code => { clearTimeout(timer); resolve({ code: code ?? -1, out: text, ms: Date.now() - t0 }); });
  });
}

function git(dir, ...args) {
  if (!existsSync(path.join(dir, '.git'))) return '';
  return spawnSync('git', ['-c', 'core.pager=cat', ...args], { cwd: dir, encoding: 'utf8' }).stdout ?? '';
}

// What the run changed since the copy was made (commits included), and the patch for you to read
function diff(dir, head, patchFile) {
  if (!head) return null;
  const files = git(dir, 'status', '--porcelain', '--untracked-files=all').split('\n').filter(Boolean).map(l => l.slice(3));
  let added = 0, removed = 0;
  for (const l of git(dir, 'diff', '--numstat', head).split('\n')) {
    const [a, d] = l.split('\t');
    added += Number(a) || 0;
    removed += Number(d) || 0;
  }
  let patch = git(dir, 'diff', head);
  for (const f of git(dir, 'ls-files', '--others', '--exclude-standard').split('\n').filter(Boolean)) {
    let body = '';
    try { body = readFileSync(path.join(dir, f), 'utf8'); } catch { continue; }
    added += body.split('\n').length - (body.endsWith('\n') ? 1 : 0);
    patch += `\n--- new file: ${f}\n${body}`;
  }
  writeFileSync(patchFile, patch);
  const commits = git(dir, 'rev-list', '--count', `${head}..HEAD`).trim();
  return { files, added, removed, commits: Number(commits) || 0 };
}

function describe(input, dir) {
  if (!input) return '';
  if (input.command) return input.command.split('\n')[0];
  if (input.file_path) return path.isAbsolute(input.file_path) ? path.relative(dir, input.file_path) : input.file_path;
  return JSON.stringify(input).slice(0, 80);
}

function inside(p, folder) {
  const rel = path.relative(folder, p);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function median(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2, 3);
}

function round(x, d = 3) {
  return Math.round(x * 10 ** d) / 10 ** d;
}

function clock(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function usd(x) {
  return `$${x < 1 ? x.toFixed(3) : x.toFixed(2)}`;
}

function wrap(text, width) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (line && line.length + 1 + word.length > width) { lines.push(line); line = word; } else line = line ? `${line} ${word}` : word;
  }
  return line ? [...lines, line] : lines;
}

function num(n) {
  return Math.round(n).toLocaleString('en-US');
}

function pad(s, w) {
  return String(s) + ' '.repeat(Math.max(0, w - String(s).length));
}

function cols() {
  return process.stdout.columns || 100;
}

function laneColor(i) {
  return ['36', '35', '33', '34', '32'][i % 5];
}

function paint(code, s) {
  return color ? `\x1b[${code}m${s}\x1b[0m` : s;
}

// Cut a line to the screen width (colour codes don't count), so the table never wraps
function fit(line, width) {
  let shown = 0, outText = '';
  for (const part of line.split(/(\x1b\[[0-9;]*m)/)) {
    if (part.startsWith('\x1b[')) { outText += part; continue; }
    const room = width - 1 - shown;
    if (room <= 0) continue;
    const chars = [...part];
    outText += chars.slice(0, room).join('');
    shown += Math.min(chars.length, room);
  }
  return outText;
}
