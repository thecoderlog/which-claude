#!/usr/bin/env node
// staircase.mjs: week 22's hidden check.
//   node staircase.mjs <c3|c4|c6>
// Runs inside a run's copy of the till after the agent has finished. The agent never sees it, its carts
// or the reference till it compares with (ref/till-ref.mjs, which follows the specs line by line).
// c3: the offers, returns, weighed items and the till's own rounding; c4: + the voucher;
// c6: + the staff discount and big orders (docs/speed.md), checked here too.
// (The video also ran s1-s4, c1, c2 and c5; the letters below still accept them.)
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Report, till, lines, cartFiles, testsPass, WIDTH } from './lib.mjs';

const VARIANT = process.argv[2];
const FEATURES = { s1: 'o', s2: 'w', s3: 'we', s4: 'wes', c1: 'o', c2: 'w', c3: 'we', c4: 'wev', c5: 'wevs', c6: 'wevsp' }[VARIANT];
if (!FEATURES) { console.error('usage: node staircase.mjs <s1-s4|c1-c6>'); process.exit(2); }
const HAS = f => f === '' || f.split('').every(x => FEATURES.includes(x));
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OFFERS = path.join(HERE, 'ref', ['s1', 'c1'].includes(VARIANT) ? 'offers-s1.json' : 'offers-s2.json');
const ref = (...args) => {
  const p = spawnSync('node', [path.join(HERE, 'ref', 'till-ref.mjs'), FEATURES, OFFERS, ...args], { encoding: 'utf8' });
  return { code: p.status, out: p.stdout ?? '', err: p.stderr ?? '' };
};

const r = new Report(`staircase-${VARIANT}`);
const MLK = ['MLK02', 'Oat milk 1L', '1.85'], CHC = ['CHC07', 'Dark chocolate', '1.95'], BRD = ['BRD01', 'Sourdough loaf', '3.20'];
const CRS = ['CRS08', 'Croissant', '1.90'], BUN = ['BUN09', 'Cinnamon bun', '1.10'], COF = ['COF05', 'Ground coffee', '6.75'];
const APL = ['APL03', 'Apples (6)', '2.40'], CHS = ['CHS04', 'Cheddar 400g', '4.50'], PER = ['PER11', 'Pears', '0.65'];
const BAN = ['BAN10', 'Bananas', '1.20/kg'], CAR = ['CAR12', 'Loose carrots', '1.34/kg'], LEE = ['LEE13', 'Leeks', '1.30/kg'];
const TEA = ['TEA06', 'Breakfast tea 80', '3.10'];
const q = (item, n) => [...item, n];

// [features it needs ('' = always), name, cart rows (or the sample cart), extra args, what it tests]
const CASES = [
  // the offers (week 18's race; done already in the s variants, part of the task in the c variants)
  ['', 'sample cart', null, [], 'nothing returned: the offers as in docs/offers.md'],
  ['', 'sample cart, 31 Oct', null, ['--date', '2026-10-31'], 'the last day of the tea offer counts'],
  ['', '2 sourdough + croissant', [q(BRD, 2), q(CRS, 1)], [], 'the mix saves more than the sourdough pair'],
  ['', '4 sourdough + bun', [q(BRD, 4), q(BUN, 1)], [], 'the three dearest items make the group'],
  ['', 'croissant + 2 buns', [q(CRS, 1), q(BUN, 2)], [], 'the mix would cost more, so no offer'],
  ['', '3 coffees', [q(COF, 3)], [], '10% of the whole line, half penny to the customer'],
  ['', '7 milks + 5 chocolates', [q(MLK, 7), q(CHC, 5)], [], 'only full groups'],
  ['', '5 sourdough + croissant', [q(BRD, 5), q(CRS, 1)], [], 'two mixes beat a mix and a pair'],
  ['', '5 sourdough', [q(BRD, 5)], [], 'a mix and a pair, in offers.json order'],
  // returns
  ['', 'return 1 of 3 oat milks', [q(MLK, 3), q(MLK, -1)], [], 'the 3 for 2 no longer applies'],
  ['', 'oat milk on two rows', [q(MLK, 2), q(CHS, 1), q(MLK, 1)], [], 'rows of one sku count together'],
  ['', 'return the croissant', [q(BRD, 2), q(CRS, 1), q(CRS, -1)], [], 'the mix is undone, the sourdough pair applies'],
  ['', 'return more than bought', [q(MLK, 1), q(MLK, -2), q(APL, 1)], [], 'the rest is a refund line'],
  ['', 'return row first', [q(MLK, -1), q(BRD, 1), q(MLK, 4)], [], 'item lines in first-appearance order'],
  ['', 'refund only', [q(CHC, -1)], [], 'REFUND DUE and the VAT inside it'],
  ['', 'return 1 of 3 coffees', [q(COF, 3), q(COF, -1)], [], 'percent off on what is kept'],
  ['', 'two return rows', [q(CHC, 4), q(CHC, -1), q(CHC, -1)], [], 'returns add up'],
  ['', 'refund of 2 buns', [q(BUN, -2), q(APL, 1)], [], 'Refund line with x2'],
  ['', 'returns regroup the bakery', [q(BRD, 5), q(CRS, 1), q(BRD, -2)], [], 'offers worked out again on what is kept'],
  // weighed items
  ['w', 'bananas', [q(BAN, '0.850')], [], 'a weighed line and its percent off'],
  ['w', 'bananas on two rows', [q(BAN, '0.500'), q(APL, 1), q(BAN, '0.350')], [], 'weights add up'],
  ['w', 'return some bananas', [q(BAN, '1.000'), q(BAN, '-0.250')], [], 'a minus weight comes off'],
  ['w', 'carrots, a half penny', [q(CAR, '0.250')], [], 'the rounding of a weighed line'],
  ['w', 'leeks, a half penny', [q(LEE, '0.250')], [], 'the rounding of a weighed line'],
  ['w', 'apples + bananas', [q(APL, 2), q(BAN, '1.000')], [], 'weighed items never go in the fruit mix'],
  ['w', 'apples + pears', [q(APL, 2), q(PER, 1)], [], 'the fruit mix itself'],
  ['w', 'refund some bananas', [q(BAN, '-0.250'), q(APL, 1)], [], 'Refund line with the weight'],
  // the voucher
  ['v', 'voucher, sample cart', null, ['--voucher'], '£2 off a TOTAL over £15'],
  ['v', 'voucher at exactly £15', [q(CHS, 2), q(CRS, 2), q(BUN, 2)], ['--voucher'], '£15.00 counts'],
  ['v', 'voucher: leave an offer out', [q(CHC, 2), q(CHS, 2), q(APL, 1)], ['--voucher'], 'cheaper without the chocolate offer'],
  ['v', 'voucher: one group, not two', [q(CHC, 4), q(BRD, 1), q(TEA, 1), q(APL, 1)], ['--voucher'], 'cheaper with one chocolate group'],
  ['v', 'voucher after a refund', [q(CHS, 4), q(CHC, -2)], ['--voucher'], 'the refund takes it under £15'],
  ['v', 'voucher first, with a date', null, ['--voucher', 'CART', '--date', '2026-10-31'], '--voucher before the cart'],
  // the staff discount
  ['s', 'staff, sample cart', null, ['--staff'], '10% of the TOTAL, the till\'s rounding'],
  ['s', 'staff with a refund', [q(APL, 2), q(CHC, -1)], ['--staff'], '10% of the TOTAL after the refund'],
  ['s', 'staff first, with a date', null, ['--staff', 'CART', '--date', '2026-10-31'], '--staff before the cart, with --date'],
  ['s', 'staff, refund due', [q(CHC, -2)], ['--staff'], 'no staff line when the shop owes money'],
  ['ws', 'staff with bananas', [q(BAN, '0.850'), q(MLK, 3)], ['--staff'], 'weighed lines and offers, then staff'],
  ['vs', 'staff and voucher', [q(CHC, 4), q(BRD, 1), q(TEA, 1), q(APL, 1)], ['--voucher', '--staff'], 'voucher first, then 10%'],
];
const MISTAKES = [
  ['', 'qty 0', [q(APL, 0)]], ['', 'qty 1.5', [q(APL, '1.5')]], ['', 'qty two', [q(APL, 'two')]],
  ['w', 'weight 0.85', [q(BAN, '0.85')]], ['w', 'weight 1', [q(BAN, '1')]], ['w', 'weight 0.000', [q(BAN, '0.000')]],
];
// big orders (docs/speed.md): only the TOTAL and VAT lines are compared (big carts can have more than one
// best grouping), and the receipt has to come within 2 s (the spec says 1 s; the rest is slack for node)
const BIG = [
  ['party order', [q(BRD, 24), q(CRS, 18), q(BUN, 30), q(MLK, 60), q(CHC, 40), q(APL, 15), q(PER, 12), q(COF, 6), q(BAN, '3.250'), q(BRD, -3)], ['--voucher']],
  ['café order', [q(BRD, 12), q(CRS, 10), q(BUN, 14), q(MLK, 30), q(CHC, 20), q(APL, 9), q(PER, 8), q(COF, 4)], []],
  ['300 items', [q(MLK, 100), q(CHC, 100), q(BRD, 30), q(CRS, 30), q(BUN, 40)], ['--staff']],
  ['200 rows of one', Array.from({ length: 200 }, (_, i) => q([BRD, CRS, BUN, APL, PER, MLK, CHC, COF, CHS][(i * 7 + (i >> 3)) % 9], 1)), ['--voucher']],
];
const BAD_DATES = ['2026-02-30', '2026-13-01', '26-10-31', 'tomorrow'];

const mine = CASES.filter(c => HAS(c[0]));
const carts = {};
for (const [, name, rows] of [...mine, ...MISTAKES.filter(m => HAS(m[0]))]) if (rows) carts[name] = rows;
if (HAS('p')) for (const [name, rows] of BIG) carts[name] = rows;
const { paths, cleanup } = cartFiles(carts);
const tidy = text => lines(text).join('\n').trimEnd();
try {
  testsPass(r);
  const tooWide = [];
  for (const [from, name, rows, extra, why] of mine) {
    const cart = rows ? paths[name] : 'data/cart.csv';
    const args = extra.includes('CART') ? extra.map(a => (a === 'CART' ? cart : a)) : [cart, ...extra];
    const got = till(...args);
    const want = ref(...args);
    if (want.code !== 0) throw new Error(`reference failed on ${name}: ${want.err}`);
    tooWide.push(...lines(got.out).filter(l => l.length > WIDTH));
    let detail = why;
    let ok = got.code === 0 && tidy(got.out) === tidy(want.out);
    if (got.code !== 0) detail = `exit ${got.code}: ${(got.err.trim().split('\n')[0] || '').slice(0, 90)}`;
    else if (!ok) {
      const g = lines(got.out), w = lines(want.out);
      const i = w.findIndex((l, k) => (g[k] ?? '').trimEnd() !== l.trimEnd());
      const at = i < 0 ? w.length : i;
      detail = `line ${at + 1}: ${JSON.stringify((g[at] ?? '(none)').trimEnd())}, want ${JSON.stringify(w[at] ?? '(none)')}`;
    }
    r.add(name, ok, detail);
  }
  if (HAS('p')) for (const [name, , extra] of BIG) {
    const t0 = Date.now();
    const p = spawnSync('node', ['src/cli.js', paths[name], ...extra], { encoding: 'utf8', timeout: 10_000 });
    const ms = Date.now() - t0;
    const want = ref(paths[name], ...extra);
    const tail = text => lines(text).filter(l => /^(TOTAL|REFUND DUE|incl\. VAT)/.test(l)).join(' | ');
    let detail = `${(ms / 1000).toFixed(2)} s`;
    let ok = p.status === 0 && ms <= 2000 && tail(p.stdout ?? '') === tail(want.out);
    if (p.status !== 0) detail = p.error?.code === 'ETIMEDOUT' ? 'no receipt after 10 s' : `exit ${p.status}`;
    else if (ms > 2000) detail = `took ${(ms / 1000).toFixed(1)} s`;
    else if (!ok) detail = `${tail(p.stdout)}; want ${tail(want.out)}`;
    r.add(`big: ${name}`, ok, detail);
  }
  r.add('every line fits 32 characters', tooWide.length === 0, tooWide.length ? JSON.stringify(tooWide[0]) : '');
  const bad = [];
  for (const [, name] of MISTAKES.filter(m => HAS(m[0]))) {
    const p = till(paths[name]);
    if (!(p.code === 2 && !/TOTAL|REFUND DUE/.test(p.out) && /^\s*error/i.test(p.err.trim()))) bad.push(`${name} → exit ${p.code}`);
  }
  for (const d of BAD_DATES) {
    const p = till('data/cart.csv', '--date', d);
    if (!(p.code === 2 && !/TOTAL|REFUND DUE/.test(p.out) && /^\s*error/i.test(p.err.trim()))) bad.push(`--date ${d} → exit ${p.code}`);
  }
  r.add('mistakes are errors', bad.length === 0, bad.length ? bad.join('; ') : 'all refused');
} finally {
  cleanup();
}
r.finish();
