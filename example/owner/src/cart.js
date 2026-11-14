import { readFileSync } from 'node:fs';
import { parsePrice } from './money.js';

const HEADER = 'sku,name,price,qty';

// A cart file is CSV with a header row: sku,name,price,qty
export function parseCart(text) {
  const [header, ...rows] = text.trim().split(/\r?\n/);
  if (header.trim() !== HEADER) throw new Error(`a cart starts with ${HEADER}`);
  return rows.filter(row => row.trim()).map(row => {
    const [sku, name, price, qty] = row.split(',');
    return { sku: sku.trim(), name: name.trim(), price: parsePrice(price), qty: Number(qty) };
  });
}

export function readCart(path) {
  return parseCart(readFileSync(path, 'utf8'));
}
