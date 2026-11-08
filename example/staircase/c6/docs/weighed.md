# Weighed items

Loose fruit and veg are sold by weight. In a cart, the price of a weighed item ends in `/kg`, and
its quantity is the weight in kilos, written with three decimals:

    BAN10,Bananas,1.20/kg,0.850

## Rules
- A weighed line costs the price per kilo times the weight, rounded to the penny the same way the till rounds money everywhere else.
- Rows of the same weighed sku add up their weights first, returns (a minus weight) included, and
  the line is priced on what's left. Returns and refunds work as in `docs/returns.md`.
- Weighed items never go into a multi-buy: not `buy`/`pay`, not `buy`/`price`, and not an "any 3"
  mix, even when their sku is listed in one. A `percentOff` offer does apply to a weighed line: work
  it out on the line's amount, as for any other line.

## On the receipt
The item line shows the weight instead of `x2`: the name, a space, the weight with three decimals
and `kg`.

    Bananas 0.850kg            £1.02

A refunded weighed item shows its weight the same way: `Refund Bananas 0.250kg`.

## Mistakes
A weighed row whose quantity isn't a weight with exactly three decimals (like `0.85` or `1`), or a
weight of 0.000, is an error, like the other mistakes: one line starting with `error:` to stderr,
no receipt, exit code 2.
