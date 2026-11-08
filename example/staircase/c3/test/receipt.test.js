import { test } from 'node:test';
import assert from 'node:assert/strict';
import { line, totals, receipt, WIDTH } from '../src/receipt.js';

const items = [
  { sku: 'BRD01', name: 'Sourdough loaf', price: 320, qty: 1 },
  { sku: 'MLK02', name: 'Oat milk 1L', price: 185, qty: 3 },
];

test('a line is WIDTH characters wide', () => {
  assert.equal(line('Sourdough loaf', 320).length, WIDTH);
});

test('totals add up the cart', () => {
  assert.deepEqual(totals(items), { total: 875, count: 4, vat: 146 });
});

test('the receipt ends with the total and the VAT inside it', () => {
  const lines = receipt(items);
  assert.equal(lines.at(-2), line('TOTAL', 875));
  assert.equal(lines.at(-1), line('incl. VAT (20%)', 146));
});
