#!/usr/bin/env node
// Self-checkout: before the customer pays, the screen lists the items a member of staff has to approve.
//   node src/selfcheck.js data/cart.csv
import { pathToFileURL } from 'node:url';
import { readCart } from './cart.js';

// Challenge 25: the minimum age for an item, by the first three letters of its sku (0 = anyone).
const ID_AGE = { WIN: 18, BER: 18, SPR: 18, TOB: 18, LOT: 18, NRG: 16 };

function idAge(item) {
  return ID_AGE[item.sku.slice(0, 3).toUpperCase()] ?? 0;
}

export function staffChecks(items) {
  return items.filter(item => idAge(item) > 0).map(item => `STAFF: ${item.name} needs an ID check (${idAge(item)}+)`);
}

export function screen(items) {
  const checks = staffChecks(items);
  return [...checks, checks.length ? 'Please wait for a member of staff' : 'Please pay'];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [path] = process.argv.slice(2);
  if (!path) {
    console.error('usage: node src/selfcheck.js <cart.csv>');
    process.exit(2);
  }
  try {
    console.log(screen(readCart(path)).join('\n'));
  } catch (e) {
    console.error(`error: ${e.message}`);
    process.exit(2);
  }
}
