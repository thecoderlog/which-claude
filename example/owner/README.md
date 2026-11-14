# till

Prints a shop receipt from a cart file, with this week's offers taken off.

```
node src/cli.js data/cart.csv
node src/cli.js data/cart.csv --date 2026-11-10
```

A cart file is CSV with a header row: `sku,name,price,qty`. Prices are in pounds with two decimals,
and they already include VAT, like the prices on a shop shelf. This week's offers are in
`data/offers.json` (see `docs/offers.md`).

Items with an age limit (alcohol, tobacco, lottery tickets, energy drinks) add a Challenge 25 line
to the receipt.

## Self-checkout

```
node src/selfcheck.js data/cart.csv
```

Lists the items a member of staff has to approve before the customer pays.

## Tests

```
npm test
```
