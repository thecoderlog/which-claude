# Returns at the till

Customers sometimes bring something back while they pay for their shopping. The cashier scans it
into the same cart as a row with a minus quantity:

    MLK02,Oat milk 1L,1.85,-1

## Rules
- Rows of the same sku count together, bought or returned, wherever they are in the cart.
- What is returned comes off what is bought of the same sku first. The offers are then worked out
  on what the customer keeps. So returning one oat milk out of three means the 3 for 2 no longer
  applies, and the other offers can now be grouped a different way if that makes the TOTAL lower.
- When more of a sku is returned than bought, the rest is refunded at the price on the row.
- A quantity of 0, or one that isn't a whole number, is a mistake (see below).

## On the receipt
- One item line per sku the customer keeps, in the order that sku first appears in the cart, for
  what they keep at full price (`x2` and so on when they keep more than one, as now). A sku they keep
  none of has no item line.
- The offer lines stay as they are, under the item lines.
- Under the offer lines, one line per refunded sku, in the same first-appearance order:
  `Refund ` and the item's name (with `x2` and so on when more than one is refunded), and the
  refund as a minus amount.
- The TOTAL takes the refunds off. When it comes out below zero the shop owes the customer: that
  line says `REFUND DUE` instead of `TOTAL`, with the amount owed as a plain (not minus) amount.
  The VAT line is then the VAT inside the amount owed, also a plain amount.

    Oat milk 1L x2             £3.70
    Refund Dark chocolate     -£1.95
    --------------------------------
    TOTAL                      £1.75
    incl. VAT (20%)            £0.29

## Mistakes
A quantity of 0, or one that isn't a whole number (like `1.5` or `two`), is an error: print one
line starting with `error:` to stderr, print no receipt, and exit with code 2.
