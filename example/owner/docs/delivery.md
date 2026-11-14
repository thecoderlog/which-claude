# Delivery slips

Online orders are picked in the shop and taken out by van. `--slip` prints the picking slip for a
cart instead of the receipt:

    node src/cli.js data/cart.csv --slip

## On the slip
- The first line is `PICKING SLIP`, then a rule of 32 dashes, like the receipt.
- One line per row of the cart, in the cart's order: the quantity, ` x `, and the item's name,
  such as `3 x Oat milk 1L`. No prices: the customer has paid online.
- An item with an age limit gets ` (ID 18+)` or ` (ID 16+)` after its name, because the driver has
  to see ID at the door. The age limits are the ones the till already uses for its age check.
- Then another rule, and `Items: ` with the number of items (the quantities added up).
- When anything on the slip has an age limit, the slip ends with `Driver: check ID at the door`.

    PICKING SLIP
    --------------------------------
    1 x Sourdough loaf
    2 x Red wine 75cl (ID 18+)
    4 x Energy drink 250ml (ID 16+)
    --------------------------------
    Items: 7
    Driver: check ID at the door

The offers and `--date` don't change the slip.
