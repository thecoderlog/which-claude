import { formatMoney } from './money.js';
import { applyOffers } from './offers.js';

export const WIDTH = 32;
export const VAT_RATE = 20; // percent; shelf prices already include it

// Age limits go by the first three letters of the sku. The law says 18 for wine, beer, spirits,
// tobacco and lottery tickets. Energy drinks are the shop's own rule: 16.
const AGE_18 = ['WIN', 'BER', 'SPR', 'TOB', 'LOT'];

export function ageLimit(item) {
  const prefix = item.sku.slice(0, 3).toUpperCase();
  if (AGE_18.includes(prefix)) return 18;
  if (prefix === 'NRG') return 16;
  return 0;
}

// One receipt line: the label on the left, the amount on the right.
export function line(label, pence, width = WIDTH) {
  const amount = formatMoney(pence);
  return label + ' '.repeat(Math.max(1, width - label.length - amount.length)) + amount;
}

// The VAT inside a VAT-inclusive amount
export function vatIn(total) {
  return Math.round((total * VAT_RATE) / (100 + VAT_RATE));
}

export function totals(items, offers = []) {
  const full = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const count = items.reduce((sum, item) => sum + item.qty, 0);
  const { saved, lines } = applyOffers(items, offers);
  const total = full - saved;
  return { total, count, vat: vatIn(total), offerLines: lines };
}

export function receipt(items, { shop = 'CORNER SHOP', offers = [] } = {}) {
  const { total, vat, offerLines } = totals(items, offers);
  const rule = '-'.repeat(WIDTH);
  // Challenge 25: the cashier asks anyone who looks under 25 for ID, for the highest limit in the cart
  const limit = Math.max(0, ...items.map(ageLimit));
  return [
    ' '.repeat(Math.floor((WIDTH - shop.length) / 2)) + shop,
    rule,
    ...items.map(item => line(item.qty > 1 ? `${item.name} x${item.qty}` : item.name, item.price * item.qty)),
    ...offerLines.map(({ offer, saved }) => line(offer.label, -saved)),
    rule,
    line('TOTAL', total),
    line(`incl. VAT (${VAT_RATE}%)`, vat),
    ...(limit ? [rule, `CHALLENGE 25: ID ${limit}+ checked`] : []),
  ];
}
