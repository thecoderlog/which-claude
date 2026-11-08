# This week's voucher

This week's paper voucher takes £2.00 off a shop of £15.00 or more. When a customer hands one
over, the cashier adds `--voucher`:

    node src/cli.js data/cart.csv --voucher

## Rules
- The voucher counts when the TOTAL, after the offers and any refunds, is £15.00 or more. Then
  £2.00 comes off it.
- The offers rule still holds: use the choice of offers that makes the TOTAL lowest, and with a
  voucher that means the TOTAL after the voucher. So sometimes it is cheaper for the customer to
  leave an offer out, or to use it fewer times, and stay at £15.00 or more.
- No voucher when the shop owes the customer money (`REFUND DUE`).
- `--voucher` can come before or after the cart file, and with `--date`.

## On the receipt
A line `Voucher` with -£2.00, after the offer lines and the refund lines, just above the rule.
When the voucher doesn't count, there is no line and the receipt is as it would be without it.
