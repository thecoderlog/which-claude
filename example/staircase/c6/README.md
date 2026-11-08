# till

Prints a shop receipt from a cart file.

```
node src/cli.js data/cart.csv
```

A cart file is CSV with a header row: `sku,name,price,qty`. Prices are in pounds with two decimals,
and they already include VAT, like the prices on a shop shelf.

This week's multi-buy offers are in `data/offers.json`. The till doesn't apply them yet.

## Tests

```
npm test
```
