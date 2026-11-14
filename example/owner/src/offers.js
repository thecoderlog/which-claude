// This week's offers (docs/offers.md): which groups to make, and what each offer saved.
import { readFileSync } from 'node:fs';
import { parsePrice } from './money.js';

export function loadOffers(path = new URL('../data/offers.json', import.meta.url)) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

// An offer with an `until` date ends after that day. Days are YYYY-MM-DD, so they compare as text.
export function activeOffers(offers, day) {
  return offers.filter(offer => !offer.until || day <= offer.until);
}

// What one group of an offer saves, given the prices of the items in it (in pence)
function groupSaving(offer, prices) {
  const full = prices.reduce((sum, p) => sum + p, 0);
  if (offer.pay !== undefined) return full - (full / offer.buy) * offer.pay;
  return full - parsePrice(offer.price);
}

// Every way to pick `n` items from the counts in `left`, as lists of skus (dearest first)
function picks(skus, left, n, start = 0) {
  if (n === 0) return [[]];
  const out = [];
  for (let i = start; i < skus.length; i++) {
    if (!left[skus[i]]) continue;
    left[skus[i]]--;
    for (const rest of picks(skus, left, n - 1, i)) out.push([skus[i], ...rest]);
    left[skus[i]]++;
  }
  return out;
}

// items: [{ sku, price, qty }] with one entry per sku. Returns the saving of each offer that saved
// money, in the order of `offers`: [{ offer, saved }], and the total saved.
export function applyOffers(items, offers) {
  const price = {};
  const start = {};
  for (const item of items) {
    price[item.sku] = item.price;
    start[item.sku] = (start[item.sku] ?? 0) + item.qty;
  }
  const memo = new Map();

  // The best saving from the items still in `left`: try one more group of each offer, or stop
  function best(left) {
    const key = JSON.stringify(left);
    if (memo.has(key)) return memo.get(key);
    let top = { saved: 0, used: offers.map(() => 0) };
    offers.forEach((offer, o) => {
      const options = [];
      if (offer.percentOff !== undefined) {
        // the whole line of what's left of the item; a half penny goes to the customer
        const n = left[offer.sku] ?? 0;
        if (n > 0) options.push({ skus: Array(n).fill(offer.sku), saved: Math.floor((price[offer.sku] * n * offer.percentOff) / 100 + 0.5) });
      } else {
        const skus = (offer.skus ?? [offer.sku]).filter(s => left[s] > 0).sort((a, b) => price[b] - price[a]);
        for (const pick of picks(skus, { ...left }, offer.buy)) {
          options.push({ skus: pick, saved: groupSaving(offer, pick.map(s => price[s])) });
        }
      }
      for (const option of options) {
        if (option.saved <= 0) continue; // a group only counts if it saves money
        const next = { ...left };
        for (const s of option.skus) next[s]--;
        const rest = best(next);
        if (rest.saved + option.saved > top.saved) {
          const used = [...rest.used];
          used[o] += option.saved;
          top = { saved: rest.saved + option.saved, used };
        }
      }
    });
    memo.set(key, top);
    return top;
  }

  const { saved, used } = best(start);
  return { saved, lines: offers.map((offer, o) => ({ offer, saved: used[o] })).filter(l => l.saved > 0) };
}
