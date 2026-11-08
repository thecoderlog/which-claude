# Staff discount

Staff get 10% off their shopping. The cashier adds `--staff`:

    node src/cli.js data/cart.csv --staff

## Rules
- The discount is 10% of the TOTAL, after the offers, the refunds and the voucher, rounded to the
  penny the same way the till rounds money everywhere else.
- It goes on its own line, `Staff 10% off`, with what it took off as a minus amount, after the
  offer lines, the refund lines and the voucher line, just above the rule.
- The TOTAL and the VAT line are then for what's left to pay.
- When the shop owes the customer money (`REFUND DUE`), there is no staff discount and no staff line.
- `--staff` can come before or after the cart file, and with `--date` and `--voucher`.
