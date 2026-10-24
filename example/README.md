# The race from the video

`till/` is a small Node app that prints a shop receipt. Its `docs/split.md` asks for a `--split` flag
that splits the bill between friends, down to the penny. `checks/split.mjs` is the hidden check: it
runs the tests, then tries carts and splits the agent never saw, including the rounding rule that's
easy to miss. It prints one line per check and ends with `pass: ...` or `fail: ...`.

```
cd till
git init -q && git add -A && git commit -qm "the till"
which-claude "Add a --split flag that splits the bill between people, as described in docs/split.md. Add tests." \
  --check "node $PWD/../checks/split.mjs" --runs 5 --max-dollars 15
```
