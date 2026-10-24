import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCart } from '../src/cart.js';

test('parseCart reads each row', () => {
  const items = parseCart('sku,name,price,qty\nBRD01,Sourdough loaf,3.20,1\nMLK02,Oat milk 1L,1.85,3\n');
  assert.deepEqual(items, [
    { sku: 'BRD01', name: 'Sourdough loaf', price: 320, qty: 1 },
    { sku: 'MLK02', name: 'Oat milk 1L', price: 185, qty: 3 },
  ]);
});

test('parseCart wants the header row', () => {
  assert.throws(() => parseCart('BRD01,Sourdough loaf,3.20,1'));
});
