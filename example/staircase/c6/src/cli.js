#!/usr/bin/env node
import { readCart } from './cart.js';
import { receipt } from './receipt.js';

const [path] = process.argv.slice(2);
if (!path) {
  console.error('usage: node src/cli.js <cart.csv>');
  process.exit(2);
}
console.log(receipt(readCart(path)).join('\n'));
