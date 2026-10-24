// lib.mjs: what the hidden checks share. A check runs inside one run's copy of the repo, after the
// agent has finished, and prints one line per check, a JSON line, then a last line that says
// "pass: ..." or "fail: <the first required check that failed>". Exit code 0 means pass.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const WIDTH = 32;

// The receipt for data/cart.csv before any change (the till at f7473e3)
export const PLAIN = `          CORNER SHOP
--------------------------------
Sourdough loaf             £3.20
Oat milk 1L x3             £5.55
Apples (6) x2              £4.80
Cheddar 400g               £4.50
Ground coffee x2          £13.50
Breakfast tea 80           £3.10
Dark chocolate x4          £7.80
--------------------------------
TOTAL                     £42.45
incl. VAT (20%)            £7.08`;

export function run(cmd, args, timeout = 30_000) {
  const p = spawnSync(cmd, args, {
    encoding: 'utf8', timeout, env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
  });
  return { code: p.status ?? -1, out: p.stdout ?? '', err: (p.stderr ?? '') + (p.error ? String(p.error) : '') };
}

export const till = (...args) => run('node', ['src/cli.js', ...args]);

export function lines(text) {
  return text.replace(/\r/g, '').split('\n').map(l => l.replace(/\s+$/, '')).filter((l, i, all) => l || i < all.length - 1);
}

// "£21.23" or "-£1.85" at the end of a line, as pence
export function amountAtEnd(line) {
  const m = /(-?)£(\d+)\.(\d{2})\s*$/.exec(line);
  return m ? (m[1] ? -1 : 1) * (Number(m[2]) * 100 + Number(m[3])) : null;
}

export const money = p => `${p < 0 ? '-' : ''}£${Math.floor(Math.abs(p) / 100)}.${String(Math.abs(p) % 100).padStart(2, '0')}`;

// Carts the agent never saw, in a folder outside the repo
export function cartFiles(carts) {
  const dir = mkdtempSync(join(tmpdir(), 'hidden-check-'));
  const paths = {};
  for (const [name, rows] of Object.entries(carts)) {
    paths[name] = join(dir, `${name}.csv`);
    writeFileSync(paths[name], 'sku,name,price,qty\n' + rows.map(r => r.join(',')).join('\n') + '\n');
  }
  return { paths, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

export function changedFiles() {
  const p = run('git', ['-c', 'core.pager=cat', 'status', '--porcelain', '--untracked-files=all']);
  return p.out.split('\n').filter(Boolean).map(l => l.slice(3).trim()).sort();
}

export function testsText() {
  const p = run('git', ['ls-files', '--cached', '--others', '--exclude-standard', 'test']);
  return p.out.split('\n').filter(Boolean).map(f => { try { return readFileSync(f, 'utf8'); } catch { return ''; } }).join('\n');
}

export class Report {
  constructor(name) { this.name = name; this.checks = []; }
  add(id, ok, detail = '', required = true) {
    this.checks.push({ id, ok: Boolean(ok), required, detail });
    console.log(`${ok ? '✓' : '✗'} ${id}${required ? '' : ' (extra)'}${detail ? `: ${detail}` : ''}`);
    return ok;
  }
  finish() {
    const failed = this.checks.filter(c => c.required && !c.ok);
    const req = this.checks.filter(c => c.required);
    const pass = failed.length === 0;
    console.log('JSON ' + JSON.stringify({ check: this.name, pass, checks: this.checks }));
    console.log(pass ? `pass: ${req.length} of ${req.length} checks`
                     : `fail: ${failed[0].id}${failed[0].detail ? ` (${failed[0].detail})` : ''}`);
    process.exit(pass ? 0 : 1);
  }
}

export function testsPass(report) {
  const p = run('npm', ['test', '--silent'], 180_000);
  const tail = (p.out + p.err).trim().split('\n').filter(l => /^# (pass|fail)/.test(l)).join(', ');
  return report.add('tests', p.code === 0, tail || `npm test exit ${p.code}`);
}

export function plainUnchanged(report) {
  const p = till('data/cart.csv');
  const same = p.code === 0 && lines(p.out).join('\n').trimEnd() === PLAIN;
  return report.add('plain receipt unchanged', same, same ? '' : `exit ${p.code}, ${lines(p.out).length} lines`);
}
