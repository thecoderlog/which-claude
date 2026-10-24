import { formatMoney } from './money.js';

export const WIDTH = 32;
export const VAT_RATE = 20; // percent; shelf prices already include it

// One receipt line: the label on the left, the amount on the right.
export function line(label, pence, width = WIDTH) {
  const amount = formatMoney(pence);
  return label + ' '.repeat(Math.max(1, width - label.length - amount.length)) + amount;
}

export function totals(items) {
  const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const count = items.reduce((sum, item) => sum + item.qty, 0);
  // the VAT inside a VAT-inclusive total
  const vat = Math.round((total * VAT_RATE) / (100 + VAT_RATE));
  return { total, count, vat };
}

export function receipt(items, shop = 'CORNER SHOP') {
  const { total, vat } = totals(items);
  const rule = '-'.repeat(WIDTH);
  return [
    ' '.repeat(Math.floor((WIDTH - shop.length) / 2)) + shop,
    rule,
    ...items.map(item => line(item.qty > 1 ? `${item.name} x${item.qty}` : item.name, item.price * item.qty)),
    rule,
    line('TOTAL', total),
    line(`incl. VAT (${VAT_RATE}%)`, vat),
  ];
}
