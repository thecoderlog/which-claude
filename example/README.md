# The races from the videos

Versions of the same small Node app that prints a shop receipt, each with a spec in `docs/` and a
hidden check in `checks/`. A check runs the tests, then tries carts and options the agent never saw.
It prints one line per check and ends with `pass: ...` or `fail: ...`.

`staircase/` is the effort staircase (week 22): three harder tills with the offers still to write.
`c3` adds returns, weighed fruit and a rounding helper the new code has to find, `c4` adds a voucher,
and `c6` adds a staff discount and a page on big orders (`docs/speed.md`). Two hidden checks:
`checks/staircase.mjs` compares the whole receipt with a reference till, and `checks/bigorders.mjs`
wants four big orders right in 2 seconds each. Run both, and climb:

```
cd staircase/c3
git init -q && git add -A && git commit -qm "the till"
which-claude "Apply this week's offers and add returns and weighed items, as described in docs/offers.md, docs/returns.md and docs/weighed.md. Add tests." \
  --check "node $PWD/../checks/staircase.mjs c3 && node $PWD/../checks/bigorders.mjs c3" \
  --models opus --climb --runs 3 --max-dollars 30 --timeout 45
```

For `c4` the task is "Apply this week's offers and add returns, weighed items and the voucher, as
described in docs/offers.md, docs/returns.md, docs/weighed.md and docs/voucher.md. Add tests." For `c6`
it's "Apply this week's offers and add returns, weighed items, the voucher, the staff discount and big
orders, as described in docs/offers.md, docs/returns.md, docs/weighed.md, docs/voucher.md, docs/staff.md
and docs/speed.md. Add tests." (`staircase.mjs c6` already includes the big orders.)

`offers/` is the effort race (week 18). Its `docs/offers.md` asks the till to apply this week's offers
and pick the cheapest way to share items between them. `checks/offers.mjs` has 14 checks, including
baskets where two offers compete for the same loaf and dates that don't exist.

```
cd offers
git init -q && git add -A && git commit -qm "the till"
which-claude "Apply this week's offers as described in docs/offers.md. Add tests." \
  --check "node $PWD/../checks/offers.mjs" --models opus --sweep --runs 1 --max-dollars 10 --timeout 40
```

`till/` is the model race (week 14). Its `docs/split.md` asks for a `--split` flag that splits the bill
between friends, down to the penny, with a rounding rule that's easy to miss.

```
cd till
git init -q && git add -A && git commit -qm "the till"
which-claude "Add a --split flag that splits the bill between people, as described in docs/split.md. Add tests." \
  --check "node $PWD/../checks/split.mjs" --runs 5 --max-dollars 15
```
