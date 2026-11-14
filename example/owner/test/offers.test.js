import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeOffers, applyOffers } from '../src/offers.js';

const OFFERS = [
  { sku: 'MLK02', label: 'Oat milk 3 for 2', buy: 3, pay: 2 },
  { sku: 'CHC07', label: 'Chocolate 2 for £3', buy: 2, price: '3.00' },
  { sku: 'COF05', label: 'Coffee 10% off', percentOff: 10 },
  { sku: 'BRD01', label: 'Sourdough 2 for £5', buy: 2, price: '5.00' },
  { skus: ['BRD01', 'CRS08', 'BUN09'], label: 'Any 3 bakery for £5', buy: 3, price: '5.00' },
  { sku: 'TEA06', label: 'Tea half price', percentOff: 50, until: '2026-10-31' },
];
const saved = (items, offers = OFFERS) => applyOffers(items, offers).lines.map(l => [l.offer.label, l.saved]);

test('3 for 2 only counts full groups', () => {
  assert.deepEqual(saved([{ sku: 'MLK02', price: 185, qty: 7 }]), [['Oat milk 3 for 2', 370]]);
});

test('the bakery mix beats the sourdough pair', () => {
  assert.deepEqual(saved([{ sku: 'BRD01', price: 320, qty: 2 }, { sku: 'CRS08', price: 190, qty: 1 }]), [['Any 3 bakery for £5', 330]]);
});

test('percent off works on the whole line, half a penny to the customer', () => {
  assert.deepEqual(saved([{ sku: 'COF05', price: 675, qty: 3 }]), [['Coffee 10% off', 203]]);
});

test('a group that costs more is not made', () => {
  assert.deepEqual(saved([{ sku: 'CRS08', price: 190, qty: 1 }, { sku: 'BUN09', price: 110, qty: 2 }]), []);
});

test('an offer ends after its until day', () => {
  assert.equal(activeOffers(OFFERS, '2026-10-31').length, 6);
  assert.equal(activeOffers(OFFERS, '2026-11-01').length, 5);
});
