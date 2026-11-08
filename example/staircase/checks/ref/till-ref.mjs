#!/usr/bin/env node
// till-ref.mjs: the reference till for week 22's steps (never shown to the agent). Same CLI as the till:
//   node till-ref.mjs <features> <offers.json> <cart.csv> [--date D] [--staff] [--voucher]
// features: letters: w weighed items, e the till's half-to-even rounding, v the voucher, s the staff discount
// (returns and the offers are always on; give o for neither)
import { readFileSync } from 'node:fs';

const [stepArg, offersPath, ...args] = process.argv.slice(2);
const F = new Set(stepArg.split(''));
const WIDTH = 32;
const fail = m => { console.error(`error: ${m}`); process.exit(2); };
const money = p => `${p < 0 ? '-' : ''}£${Math.floor(Math.abs(p) / 100)}.${String(Math.abs(p) % 100).padStart(2, '0')}`;
const line = (l, p) => l + ' '.repeat(Math.max(1, WIDTH - l.length - money(p).length)) + money(p);
const halfEven = x => { const f = Math.floor(x); return Math.abs(x - f - 0.5) < 1e-9 ? (f % 2 === 0 ? f : f + 1) : Math.round(x); };
const tillRound = x => (F.has('e') ? halfEven(x) : Math.round(x));
const halfDown = x => { const f = Math.floor(x); return Math.abs(x - f - 0.5) < 1e-9 ? f : Math.round(x); };
const isDay = t => /^\d{4}-\d{2}-\d{2}$/.test(t ?? '') && !Number.isNaN(new Date(`${t}T00:00:00Z`).getTime()) && new Date(`${t}T00:00:00Z`).toISOString().slice(0, 10) === t;
const parsePrice = t => { const m = /^(\d+)\.(\d{2})$/.exec(String(t).trim()); if (!m) throw new Error(`not a price: ${t}`); return Number(m[1]) * 100 + Number(m[2]); };

// RFC 4180: fields in double quotes may hold commas, line breaks and "" for a quote; CRLF or LF
function csv(text) {
  const out = []; let rec = [], f = '', q = false, i = 0, quoted = false;
  while (i < text.length) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i += 2; continue; } q = false; i++; continue; }
      f += ch; i++; continue;
    }
    if (ch === '"' && f.trim() === '') { q = true; quoted = true; f = ''; i++; continue; }
    if (ch === ',') { rec.push(f); f = ''; quoted = false; i++; continue; }
    if (ch === '\r' && text[i + 1] === '\n') { i++; continue; }
    if (ch === '\n') { rec.push(f); out.push(rec); rec = []; f = ''; quoted = false; i++; continue; }
    f += ch; i++;
  }
  if (f !== '' || rec.length || quoted) { rec.push(f); out.push(rec); }
  return out;
}
let path, staff = false, voucher = false, day = new Date().toISOString().slice(0, 10);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--date') { day = args[++i]; if (!isDay(day)) fail('bad date'); }
  else if (args[i] === '--staff' && F.has('s')) staff = true;
  else if (args[i] === '--voucher' && F.has('v')) voucher = true;
  else if (!path) path = args[i];
  else fail('unexpected argument');
}
const offers = JSON.parse(readFileSync(offersPath, 'utf8')).filter(o => !o.until || day <= o.until);

// cart: per sku in first-appearance order: { sku, name, price, weighed, units (int) or grams (int) }
const skus = [];
const by = {};
try {
  let records;
  if (F.has('c')) {
    records = csv(readFileSync(path, 'utf8').replace(/^\uFEFF/, '')).filter(rec => !(rec.length === 1 && rec[0].trim() === ''));
    const head = records.shift().map(h => h.trim().toLowerCase());
    const want = ['sku', 'name', 'price', 'qty'];
    if (head.length !== 4 || want.some(w => !head.includes(w))) throw new Error('header');
    records = records.map(rec => { if (rec.length !== 4) throw new Error('columns'); return want.map(w => rec[head.indexOf(w)]); });
  } else {
    const [header, ...rows] = readFileSync(path, 'utf8').trim().split(/\r?\n/);
    if (header.trim() !== 'sku,name,price,qty') throw new Error('header');
    records = rows.filter(r => r.trim()).map(r => r.split(','));
  }
  for (const rec of records) {
    const [sku, name, priceText, qtyText] = rec.map(s => s.trim());
    const weighed = F.has('w') && /\/kg$/.test(priceText);
    const price = parsePrice(weighed ? priceText.slice(0, -3) : priceText);
    let q;
    if (weighed) {
      if (!/^-?\d+\.\d{3}$/.test(qtyText)) throw new Error('weight');
      q = Math.round(Number(qtyText) * 1000);
    } else {
      if (!/^-?\d+$/.test(qtyText)) throw new Error('qty');
      q = Number(qtyText);
    }
    if (q === 0) throw new Error('zero');
    if (!by[sku]) { by[sku] = { sku, name, price, weighed, bought: 0, returned: 0 }; skus.push(sku); }
    if (q > 0) by[sku].bought += q; else by[sku].returned -= q;
  }
} catch (e) { fail(e.message); }

const kept = s => Math.max(0, by[s].bought - by[s].returned);
const refunded = s => Math.max(0, by[s].returned - by[s].bought);
const amount = (s, q) => (by[s].weighed ? (F.has('e') ? halfEven : halfDown)((by[s].price * q) / 1000) : by[s].price * q);
const label = (s, q, pre = '') => pre + by[s].name + (by[s].weighed ? ` ${(q / 1000).toFixed(3)}kg` : q > 1 ? ` x${q}` : '');

// offers: best saving by search, as in docs/offers.md (weighed items only in percentOff)
const left0 = {};
for (const s of skus) if (!by[s].weighed && kept(s) > 0) left0[s] = kept(s);
function picks(list, left, n, start = 0) {
  if (n === 0) return [[]];
  const out = [];
  for (let i = start; i < list.length; i++) {
    if (!left[list[i]]) continue;
    left[list[i]]--;
    for (const rest of picks(list, left, n - 1, i)) out.push([list[i], ...rest]);
    left[list[i]]++;
  }
  return out;
}
// every reachable total saving, with one way to get it (the voucher can make a smaller saving the better one)
const memo = new Map();
function all(left) {
  const key = JSON.stringify(left);
  if (memo.has(key)) return memo.get(key);
  const outs = new Map([[0, offers.map(() => 0)]]);
  offers.forEach((o, i) => {
    const opts = [];
    if (o.percentOff !== undefined) {
      if (by[o.sku] && !by[o.sku].weighed && left[o.sku] > 0) opts.push({ take: Array(left[o.sku]).fill(o.sku), saved: Math.floor((by[o.sku].price * left[o.sku] * o.percentOff) / 100 + 0.5) });
    } else {
      const list = (o.skus ?? [o.sku]).filter(s => left[s] > 0).sort((a, b) => by[b].price - by[a].price);
      for (const p of picks(list, { ...left }, o.buy)) {
        const full = p.reduce((t, s) => t + by[s].price, 0);
        opts.push({ take: p, saved: o.pay !== undefined ? full - (full / o.buy) * o.pay : full - parsePrice(o.price) });
      }
    }
    for (const op of opts) {
      if (op.saved <= 0) continue;
      const next = { ...left };
      for (const s of op.take) next[s]--;
      for (const [sv, used] of all(next)) {
        const t = sv + op.saved;
        if (!outs.has(t)) { const u = [...used]; u[i] += op.saved; outs.set(t, u); }
      }
    }
  });
  memo.set(key, outs);
  return outs;
}
// big carts: the offers fall apart into groups of skus that share an offer; the best saving of each group on its
// own (the voucher choice is only needed on small carts, and the big carts in the check are far over £15)
function clusterBest() {
  const skuList = Object.keys(left0);
  const root = Object.fromEntries(skuList.map(s => [s, s]));
  const find = s => (root[s] === s ? s : (root[s] = find(root[s])));
  for (const o of offers) {
    const ss = (o.skus ?? [o.sku]).filter(s => s in left0);
    for (const t of ss.slice(1)) root[find(t)] = find(ss[0]);
  }
  const usedAll = offers.map(() => 0);
  let savedAll = 0;
  for (const c of new Set(skuList.map(find))) {
    const mine = skuList.filter(s => find(s) === c);
    const left = Object.fromEntries(mine.map(s => [s, left0[s]]));
    const memo2 = new Map();
    const best = l => {
      const key = mine.map(s => l[s]).join(',');
      if (memo2.has(key)) return memo2.get(key);
      let top = { saved: 0, used: null };
      offers.forEach((o, i) => {
        if (!(o.skus ?? [o.sku]).some(s => mine.includes(s))) return;
        const opts = [];
        if (o.percentOff !== undefined) {
          if (by[o.sku] && !by[o.sku].weighed && l[o.sku] > 0) opts.push({ take: Array(l[o.sku]).fill(o.sku), saved: Math.floor((by[o.sku].price * l[o.sku] * o.percentOff) / 100 + 0.5) });
        } else {
          const list = (o.skus ?? [o.sku]).filter(s => l[s] > 0).sort((a, b) => by[b].price - by[a].price);
          for (const p of picks(list, { ...l }, o.buy)) {
            const full = p.reduce((t, s) => t + by[s].price, 0);
            opts.push({ take: p, saved: o.pay !== undefined ? full - (full / o.buy) * o.pay : full - parsePrice(o.price) });
          }
        }
        for (const op of opts) {
          if (op.saved <= 0) continue;
          const next = { ...l };
          for (const s of op.take) next[s]--;
          const rest = best(next);
          if (rest.saved + op.saved > top.saved) top = { saved: rest.saved + op.saved, used: [i, op.saved, rest] };
        }
      });
      memo2.set(key, top);
      return top;
    };
    let node = best(left);
    savedAll += node.saved;
    while (node && node.used) { usedAll[node.used[0]] += node.used[1]; node = node.used[2]; }
  }
  return [[savedAll, usedAll]];
}
const units = Object.values(left0).reduce((a, b) => a + b, 0);
const options = units <= 30 && !process.env.REF_FORCE_CLUSTER ? [...all(left0)].sort((a, b) => b[0] - a[0]) : clusterBest(); // biggest saving first
// percentOff on weighed lines: on the line's amount, half penny to the customer (it always saves, so never a choice)
const weighedOff = offers.map(o => (o.percentOff !== undefined && by[o.sku]?.weighed && kept(o.sku) > 0
  ? Math.floor((amount(o.sku, kept(o.sku)) * o.percentOff) / 100 + 0.5) : 0));
let items = 0, refunds = 0;
for (const s of skus) { if (kept(s) > 0) items += amount(s, kept(s)); if (refunded(s) > 0) refunds += amount(s, refunded(s)); }
const VOUCHER = 200, OVER = 1500;
const finalOf = sv => { const t = items - sv - refunds; return voucher && t >= OVER ? t - VOUCHER : t; };
let pick = null;
for (const [sv, u] of options) {
  const total = sv + weighedOff.reduce((a, b) => a + b, 0);
  if (!pick || finalOf(total) < pick.final) pick = { final: finalOf(total), used: u.map((x, i) => x + weighedOff[i]) };
}
const used = pick.used;

const out = [' '.repeat(Math.floor((WIDTH - 11) / 2)) + 'CORNER SHOP', '-'.repeat(WIDTH)];
let total = 0;
for (const s of skus) if (kept(s) > 0) { out.push(line(label(s, kept(s)), amount(s, kept(s)))); total += amount(s, kept(s)); }
offers.forEach((o, i) => { if (used[i] > 0) { out.push(line(o.label, -used[i])); total -= used[i]; } });
for (const s of skus) if (refunded(s) > 0) { out.push(line(label(s, refunded(s), 'Refund '), -amount(s, refunded(s)))); total -= amount(s, refunded(s)); }
if (voucher && total >= OVER) { out.push(line('Voucher', -VOUCHER)); total -= VOUCHER; }
if (staff && total > 0) { const off = tillRound(total / 10); out.push(line('Staff 10% off', -off)); total -= off; }
out.push('-'.repeat(WIDTH));
const vat = a => tillRound((a * 20) / 120);
if (total < 0) { out.push(line('REFUND DUE', -total), line('incl. VAT (20%)', vat(-total))); }
else out.push(line('TOTAL', total), line('incl. VAT (20%)', vat(total)));
console.log(out.join('\n'));
