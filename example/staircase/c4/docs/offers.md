# This week's offers

`data/offers.json` lists this week's offers. The till should take them off the bill.

    node src/cli.js data/cart.csv
    node src/cli.js data/cart.csv --date 2026-10-30

## The kinds of offer
- `buy` and `pay` ("3 for 2"): for every full group of `buy` of that item, the customer pays for `pay`.
- `buy` and `price` ("2 for £3"): every full group of `buy` of that item costs `price`.
- `percentOff`: that much off the item's line. Work it out on the whole line, not item by item, and
  round to the nearest penny. A half penny goes to the customer.
- `skus`, `buy` and `price` ("any 3 bakery items for £5"): any `buy` items from the listed skus,
  mixed as you like, cost `price` together.

## Rules
- An item can only be in one offer. When an item could go into more than one offer, or the items
  could be grouped in different ways, use the choice that makes the TOTAL lowest.
- A group only counts if it saves money. An offer never makes the bill bigger.
- An offer with an `until` date ends after that day. The receipt is for today, unless `--date`
  gives another day as YYYY-MM-DD.
- The VAT line is the VAT inside the TOTAL after the offers.

## On the receipt
The item lines stay as they are, at full price. Under them, one line for each offer that saved
money, in the order of `data/offers.json`: the offer's label, and what it saved as a minus amount.
When an offer is used more than once, its line shows what it saved in all. Then the rule, the TOTAL
and the VAT line as before. When no offer saves anything, the receipt is the same as it was.

    Dark chocolate x4          £7.80
    Oat milk 3 for 2          -£1.85
    Chocolate 2 for £3        -£1.80
    Coffee 10% off            -£1.35
    --------------------------------
    TOTAL                     £37.45
    incl. VAT (20%)            £6.24

## Mistakes
A `--date` that isn't a real day written as YYYY-MM-DD is an error: print one line starting with
`error:` to stderr, print no receipt, and exit with code 2.
