import { test } from 'node:test';
import assert from 'node:assert/strict';
import { line, totals, receipt, WIDTH } from '../src/receipt.js';

const items = [
  { sku: 'BRD01', name: 'Sourdough loaf', price: 320, qty: 1 },
  { sku: 'MLK02', name: 'Oat milk 1L', price: 185, qty: 3 },
];
const offers = [{ sku: 'MLK02', label: 'Oat milk 3 for 2', buy: 3, pay: 2 }];

test('a line is WIDTH characters wide', () => {
  assert.equal(line('Sourdough loaf', 320).length, WIDTH);
});

test('totals add up the cart', () => {
  assert.deepEqual(totals(items), { total: 875, count: 4, vat: 146, offerLines: [] });
});

test('the receipt ends with the total and the VAT inside it', () => {
  const lines = receipt(items);
  assert.equal(lines.at(-2), line('TOTAL', 875));
  assert.equal(lines.at(-1), line('incl. VAT (20%)', 146));
});

test('offer lines go under the items, and the total is after the offers', () => {
  const lines = receipt(items, { offers });
  assert.equal(lines[4], line('Oat milk 3 for 2', -185));
  assert.equal(lines.at(-2), line('TOTAL', 690));
});

test('an age-limited item adds the Challenge 25 line, for the highest limit', () => {
  const lines = receipt([...items, { sku: 'NRG01', name: 'Energy drink 250ml', price: 135, qty: 1 },
    { sku: 'BER04', name: 'Lager 4x440ml', price: 600, qty: 1 }]);
  assert.equal(lines.at(-2), '-'.repeat(WIDTH));
  assert.equal(lines.at(-1), 'CHALLENGE 25: ID 18+ checked');
});
