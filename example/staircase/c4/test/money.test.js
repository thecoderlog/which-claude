import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePrice, formatMoney, roundPence } from '../src/money.js';

test('parsePrice reads pounds and pence', () => {
  assert.equal(parsePrice('3.20'), 320);
  assert.equal(parsePrice('0.05'), 5);
});

test('parsePrice rejects other formats', () => {
  assert.throws(() => parsePrice('3.2'));
  assert.throws(() => parsePrice('three'));
});

test('formatMoney writes pounds and pence', () => {
  assert.equal(formatMoney(320), '£3.20');
  assert.equal(formatMoney(5), '£0.05');
  assert.equal(formatMoney(-185), '-£1.85');
});

test('roundPence rounds a half penny to the even penny', () => {
  assert.equal(roundPence(12.5), 12);
  assert.equal(roundPence(13.5), 14);
  assert.equal(roundPence(12.4), 12);
  assert.equal(roundPence(12.6), 13);
});
