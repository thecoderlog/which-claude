#!/usr/bin/env node
// split.mjs: the hidden check for test 3 and the race (docs/split.md). Run it inside a run's copy of
// the till after the agent has finished. The agent never sees it, or the carts it uses.
import { readFileSync } from 'node:fs';
import { Report, till, lines, amountAtEnd, money, cartFiles, testsPass, plainUnchanged, testsText, WIDTH } from './lib.mjs';

const r = new Report('split');
const { paths, cleanup } = cartFiles({
  ten: [['GFT01', 'Gift box', '10.00', 1]],
  ten03: [['SNK01', 'Snacks', '10.03', 1]],
  one01: [['MNT01', 'Mints', '1.01', 1]],
});

// [cart, --split value, what each person owes in pence, why the case is here]
const CASES = [
  ['data/cart.csv', 'Asha:2,Ben,Chen', [2123, 1061, 1061], 'the example in docs/split.md'],
  ['data/cart.csv', 'Asha', [4245], 'one person pays the TOTAL'],
  [paths.ten, 'Asha,Ben,Chen', [334, 333, 333], 'a tie: the one listed first gets the penny'],
  [paths.ten, 'Asha,Ben:2', [333, 667], 'the penny goes to whoever lost the most, not the first'],
  [paths.ten03, 'Ana,Bea,Cal,Dev', [251, 251, 251, 250], 'three pennies left, one each'],
  [paths.one01, 'Ann,Bo,Cy:3', [20, 20, 61], 'the biggest loss is last in the list'],
  [paths.ten, 'Zoe:3,Yan:3,Xi', [429, 428, 143], 'two pennies: the biggest loss, then a tie'],
];
const ERRORS = ['Asha,,Ben', 'Asha,Ben,Asha', 'Asha:0,Ben', 'Asha:1.5,Ben', 'Asha:two,Ben', 'Asha:-1,Ben', ':2,Ben'];

const fileOf = path => (path === 'data/cart.csv' ? 'data/cart.csv' : `£${path === paths.ten ? '10.00' : path === paths.ten03 ? '10.03' : '1.01'} cart`);

try {
  testsPass(r);
  plainUnchanged(r);

  let tooWide = [];
  for (const [cart, value, want, why] of CASES) {
    const names = value.split(',').map(x => x.split(':')[0]);
    const p = till(cart, '--split', value);
    const out = lines(p.out);
    tooWide.push(...out.filter(l => l.length > WIDTH));
    const head = out.findIndex(l => /^\s*SPLIT\b/i.test(l));
    const vat = out.findIndex(l => /VAT/i.test(l));
    const got = [];
    let at = head;
    for (const name of names) {
      const i = out.findIndex((l, j) => j > at && l.trim().toLowerCase().startsWith(name.toLowerCase()) && amountAtEnd(l) !== null);
      got.push(i < 0 ? null : amountAtEnd(out[i]));
      if (i >= 0) at = i;
    }
    const ok = p.code === 0 && head > vat && vat >= 0 && got.every((g, k) => g === want[k]);
    const detail = p.code !== 0 ? `exit ${p.code}: ${(p.err.trim().split('\n')[0] || '').slice(0, 80)}`
      : head < 0 ? 'no SPLIT line'
      : head < vat ? 'SPLIT is above the VAT line'
      : got.map(g => (g === null ? '?' : money(g))).join(', ')
        + (got.every((g, k) => g === want[k]) ? '' : `, want ${want.map(money).join(', ')}`);
    r.add(`split ${value}${cart === 'data/cart.csv' ? '' : ` of ${fileOf(cart).replace(' cart', '')}`}`, ok, ok ? why : detail);
  }

  const bad = [];
  for (const value of ERRORS) {
    const p = till('data/cart.csv', '--split', value);
    const ok = p.code === 2 && !/TOTAL/.test(p.out) && /^\s*error/i.test(p.err.trim());
    if (!ok) bad.push(`${value} → exit ${p.code}${/TOTAL/.test(p.out) ? ', printed the receipt' : ''}${/^\s*error/i.test(p.err.trim()) ? '' : ', no "error:" line'}`);
  }
  r.add('mistakes: error, no receipt, exit 2', bad.length === 0, bad.length ? bad.slice(0, 2).join('; ') : `${ERRORS.length} of ${ERRORS.length}`);
  r.add(`every line fits ${WIDTH} characters`, tooWide.length === 0, tooWide[0] ? `"${tooWide[0]}" is ${tooWide[0].length}` : '');

  r.add('tests mention the split', /split/i.test(testsText()), '', false);
  let readme = '';
  try { readme = readFileSync('README.md', 'utf8'); } catch {}
  r.add('README mentions --split', /--split/.test(readme), '', false);
} finally {
  cleanup();
}
r.finish();
