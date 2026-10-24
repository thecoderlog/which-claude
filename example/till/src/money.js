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
