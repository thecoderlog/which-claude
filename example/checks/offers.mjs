#!/usr/bin/env node
// offers.mjs: the hidden check for the race (docs/offers.md). Run it inside a run's copy of the till
// after the agent has finished. The agent never sees it, or the carts it uses.
import { Report, till, lines, amountAtEnd, money, cartFiles, testsPass, WIDTH } from './lib.mjs';

const r = new Report('offers');
const BRD = ['BRD01', 'Sourdough loaf', '3.20'], CRS = ['CRS08', 'Croissant', '1.90'], BUN = ['BUN09', 'Cinnamon bun', '1.10'];
const COF = ['COF05', 'Ground coffee', '6.75'], MLK = ['MLK02', 'Oat milk 1L', '1.85'], CHC = ['CHC07', 'Dark chocolate', '1.95'];
const q = (item, n) => [...item, n];
const { paths, cleanup } = cartFiles({
  mixBeatsPair: [q(BRD, 2), q(CRS, 1)],
  mixOfThree: [q(BRD, 4), q(BUN, 1)],
  mixTooCheap: [q(CRS, 1), q(BUN, 2)],
  coffee3: [q(COF, 3)],
  coffee1: [q(COF, 1)],
  manyGroups: [q(MLK, 7), q(CHC, 5)],
  twoMixes: [q(BRD, 5), q(CRS, 1)],
  pairAndMix: [q(BRD, 5)],
});

const SAMPLE = [['Oat milk 3 for 2', 185], ['Chocolate 2 for £3', 180], ['Coffee 10% off', 135]];
// [name, cart, extra args, the offer lines it should print in order [label, saved], why]
const CASES = [
  ['sample cart, today', 'data/cart.csv', [], SAMPLE, 'the example in docs/offers.md; the tea offer is over'],
  ['sample cart, 31 Oct', 'data/cart.csv', ['--date', '2026-10-31'], [...SAMPLE, ['Tea half price', 155]], 'the last day of the tea offer counts'],
  ['sample cart, 1 Nov', 'data/cart.csv', ['--date', '2026-11-01'], SAMPLE, 'the tea offer ended the day before'],
  ['2 sourdough + croissant', paths.mixBeatsPair, [], [['Any 3 bakery for £5', 330]], 'the mix saves more than the sourdough pair'],
  ['4 sourdough + bun', paths.mixOfThree, [], [['Any 3 bakery for £5', 460]], 'the three dearest items make the group'],
  ['croissant + 2 buns', paths.mixTooCheap, [], [], 'the mix would cost more, so no offer'],
  ['3 coffees', paths.coffee3, [], [['Coffee 10% off', 203]], '10% of the whole line, half penny to the customer'],
  ['1 coffee', paths.coffee1, [], [['Coffee 10% off', 68]], 'half penny to the customer'],
  ['7 milks + 5 chocolates', paths.manyGroups, [], [['Oat milk 3 for 2', 370], ['Chocolate 2 for £3', 180]], 'only full groups'],
  ['5 sourdough + croissant', paths.twoMixes, [], [['Any 3 bakery for £5', 790]], 'two mixes beat a mix and a pair'],
  ['5 sourdough', paths.pairAndMix, [], [['Sourdough 2 for £5', 140], ['Any 3 bakery for £5', 460]], 'a mix and a pair, in offers.json order'],
];
const BAD_DATES = ['2026-02-30', '2026-13-01', '26-10-31', 'tomorrow', '2026-1-5'];

function itemsOf(cart) {
  if (cart === 'data/cart.csv') return [[320, 1, 'Sourdough loaf'], [185, 3, 'Oat milk 1L'], [240, 2, 'Apples (6)'], [450, 1, 'Cheddar 400g'],
    [675, 2, 'Ground coffee'], [310, 1, 'Breakfast tea 80'], [195, 4, 'Dark chocolate']];
  return null;
}

try {
  testsPass(r);
  const tooWide = [];
  for (const [name, cart, extra, want, why] of CASES) {
    const p = till(cart, ...extra);
    const out = lines(p.out);
    tooWide.push(...out.filter(l => l.length > WIDTH));
    const rules = out.map((l, i) => (/^-{32}$/.test(l) ? i : -1)).filter(i => i >= 0);
    const totalAt = out.findIndex(l => /^TOTAL\b/.test(l));
    const problems = [];
    if (p.code !== 0) problems.push(`exit ${p.code}: ${(p.err.trim().split('\n')[0] || '').slice(0, 80)}`);
    else if (rules.length < 2 || totalAt !== rules[1] + 1) problems.push('the receipt shape changed (rules / TOTAL)');
    else {
      const body = out.slice(rules[0] + 1, rules[1]);
      const offerLines = body.filter(l => (amountAtEnd(l) ?? 0) < 0);
      const itemLines = body.filter(l => (amountAtEnd(l) ?? 0) >= 0);
      const gotOffers = offerLines.map(l => [l.replace(/\s*-£[\d.]+\s*$/, '').trim(), -amountAtEnd(l)]);
      const fmt = xs => xs.map(([l, s]) => `${l} -${money(s)}`).join(' | ') || 'none';
      if (fmt(gotOffers) !== fmt(want)) problems.push(`offer lines: ${fmt(gotOffers)}; want ${fmt(want)}`);
      if (body.indexOf(offerLines[0]) >= 0 && body.slice(body.indexOf(offerLines[0])).some(l => (amountAtEnd(l) ?? 0) >= 0)) problems.push('offer lines are not all under the items');
      const full = itemLines.reduce((s, l) => s + amountAtEnd(l), 0);
      const items = itemsOf(cart);
      if (items && full !== items.reduce((s, [p, n]) => s + p * n, 0)) problems.push(`item lines add up to ${money(full)}, not the full price`);
      const saved = want.reduce((s, [, v]) => s + v, 0);
      const total = full - saved;
      const vat = Math.round((total * 20) / 120);
      const gotTotal = amountAtEnd(out[totalAt]);
      const gotVat = amountAtEnd(out[totalAt + 1] ?? '');
      if (gotTotal !== total) problems.push(`TOTAL ${gotTotal == null ? '?' : money(gotTotal)}, want ${money(total)}`);
      if (!/VAT/.test(out[totalAt + 1] ?? '') || gotVat !== vat) problems.push(`VAT ${gotVat == null ? '?' : money(gotVat)}, want ${money(vat)}`);
    }
    r.add(name, problems.length === 0, problems.length ? problems[0] : why);
  }
  r.add('every line fits 32 characters', tooWide.length === 0, tooWide.length ? JSON.stringify(tooWide[0]) : '');

  const bad = [];
  for (const d of BAD_DATES) {
    const p = till('data/cart.csv', '--date', ...(d ? [d] : []));
    const ok = p.code === 2 && !/TOTAL/.test(p.out) && /^\s*error/i.test(p.err.trim());
    if (!ok) bad.push(`${d ?? '(no day)'} → exit ${p.code}${/TOTAL/.test(p.out) ? ', printed the receipt' : ''}${/^\s*error/i.test(p.err.trim()) ? '' : ', no "error:" line'}`);
  }
  r.add('bad --date is an error', bad.length === 0, bad.length ? bad[0] : `${BAD_DATES.length} bad dates refused`);
  // Extra, not counted: --date with nothing after it (the spec doesn't say what that is)
  const none = till('data/cart.csv', '--date');
  r.add('--date with no day', none.code !== 0 && !/TOTAL/.test(none.out), `exit ${none.code}`, false);
} finally {
  cleanup();
}
r.finish();
