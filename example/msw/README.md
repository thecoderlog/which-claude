# A real bug: Mock Service Worker's generator reset (week 24)

The bug is "`resetHandlers()` doesn't restart the generator" in [Mock Service Worker](https://github.com/mswjs/msw).
Cognition's [FrontierCode 2.0 post](https://cognition.com/blog/frontier-code-2.0) shows it as a sample task.

| File | What it is |
|---|---|
| `get-msw.sh` | fetches the library as it was the day before the fix (commit `edeb058`, msw 2.13.4) into `./repo`, as one commit with no history, then installs and builds it. About 3 minutes and 500 MB |
| `PROMPT.md` | the task: the bug report, then "Fix it." |
| `check.mjs` | the hidden check. Run it inside a copy of the repo after the agent has finished |
| `generator-reset.hidden.test.ts` | the seven tests the check copies in |
| `regress.txt` | the repo's own test files the check puts back and runs (100 tests) |

`check.mjs` is a test we wrote for the video. FrontierCode grades the task its own way, so a pass here isn't a FrontierCode score.

It asks two things. Three tests cover what the report asks for: after `resetHandlers()` a generator starts
again from the top. The other four check something the report never mentions: the generator that was cut off has to be
closed, so the user's `finally` block runs. A fix that only drops the old generator prints
`fail: restart ok (3 of 3), cleanup FAIL (1 of 4)` (the one cleanup test it passes checks that a generator that already finished isn't cleaned up twice).

```
./get-msw.sh
cd repo
which-claude --task-file ../PROMPT.md --check "node $PWD/../check.mjs" \
  --models opus,fable --runs 1 --max-dollars 4 --timeout 20
```

The real fix is [mswjs/msw#2725](https://github.com/mswjs/msw/pull/2725).
