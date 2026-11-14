#!/usr/bin/env node
import { readCart } from './cart.js';
import { activeOffers, loadOffers } from './offers.js';
import { receipt } from './receipt.js';

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(2);
}

// A real day written as YYYY-MM-DD
function isDay(text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text ?? '')) return false;
  const d = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === text;
}

const args = process.argv.slice(2);
let path;
let day = new Date().toISOString().slice(0, 10);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--date') {
    day = args[++i];
    if (!isDay(day)) fail(`--date wants a day as YYYY-MM-DD, not ${day ?? 'nothing'}`);
  } else if (!path) {
    path = args[i];
  } else {
    fail(`unexpected argument: ${args[i]}`);
  }
}
if (!path) {
  console.error('usage: node src/cli.js <cart.csv> [--date YYYY-MM-DD]');
  process.exit(2);
}
let items;
try {
  items = readCart(path);
} catch (e) {
  fail(e.message);
}
console.log(receipt(items, { offers: activeOffers(loadOffers(), day) }).join('\n'));
