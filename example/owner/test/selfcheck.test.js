import { test } from 'node:test';
import assert from 'node:assert/strict';
import { screen, staffChecks } from '../src/selfcheck.js';

test('age-limited items need a member of staff', () => {
  const items = [
    { sku: 'BRD01', name: 'Sourdough loaf', price: 320, qty: 1 },
    { sku: 'WIN12', name: 'Red wine 75cl', price: 850, qty: 1 },
    { sku: 'NRG01', name: 'Energy drink 250ml', price: 135, qty: 2 },
  ];
  assert.deepEqual(screen(items), [
    'STAFF: Red wine 75cl needs an ID check (18+)',
    'STAFF: Energy drink 250ml needs an ID check (16+)',
    'Please wait for a member of staff',
  ]);
});

test('a cart with nothing age-limited can be paid for straight away', () => {
  assert.deepEqual(staffChecks([{ sku: 'MLK02', name: 'Oat milk 1L', price: 185, qty: 3 }]), []);
  assert.deepEqual(screen([{ sku: 'MLK02', name: 'Oat milk 1L', price: 185, qty: 3 }]), ['Please pay']);
});
