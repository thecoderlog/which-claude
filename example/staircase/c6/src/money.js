// Money is kept as whole pence: 3.20 is 320. Totals never touch floats.

export function parsePrice(text) {
  const match = /^(\d+)\.(\d{2})$/.exec(String(text).trim());
  if (!match) throw new Error(`not a price: ${text}`);
  return Number(match[1]) * 100 + Number(match[2]);
}

export function formatMoney(pence) {
  const sign = pence < 0 ? '-' : '';
  const abs = Math.abs(pence);
  return `${sign}£${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

// Rounds an amount in pence to a whole penny. The shop's card terminal and its accounts round a half
// penny to the even penny (12.5 is 12, 13.5 is 14), so the till does the same everywhere it rounds
// money. Anything the till works out in fractions of a penny goes through here.
export function roundPence(amount) {
  const floor = Math.floor(amount);
  const diff = amount - floor;
  if (Math.abs(diff - 0.5) < 1e-9) return floor % 2 === 0 ? floor : floor + 1;
  return Math.round(amount);
}
