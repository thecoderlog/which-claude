# The races from the videos

Two versions of the same small Node app that prints a shop receipt, each with a spec in `docs/` and a
hidden check in `checks/`. A check runs the tests, then tries carts and options the agent never saw.
It prints one line per check and ends with `pass: ...` or `fail: ...`.

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
