# which-claude

Which Claude model should run your coding task? Run it on each one and look at the bill.

which-claude gives every model the same task in a fresh copy of your project, checks each result
with your own command, and shows how often each model passed, how long it took and what it really
cost. The number to look at is the **cost per passing run**: everything a model spent, divided by the
runs that passed your check.

## Why

The price list says Opus 5.5 costs twice what Sonnet 5.5 costs per token ($4 and $2 per million input
tokens, $20 and $10 per million output tokens). That's the rate, not the fare. The fare depends on how
many turns a model takes, how much it thinks, how much it reads back from the cache, and whether it
gets the job right at all: a failed run costs money, and you still have to run it again.

## Install

You need Node.js 18.17 or newer, git, and an Anthropic API key (Claude Console › API keys).

```
npm install -g github:thecoderlog/which-claude
```

Its one dependency is the Claude Agent SDK, which brings its own copy of the Claude Code engine (about
280 MB).

## Run it

In your project folder:

```
export ANTHROPIC_API_KEY=sk-ant-...        # every run is billed to this key
which-claude "Fix the date parsing bug in src/dates.js" --check "npm test"
```

For every run, which-claude copies the folder into your temp folder, lets the agent work on the task
there, then runs your check in that copy: exit code 0 means the run passed. By default Sonnet 5.5 and
Opus 5.5 run three times each, one run at a time, taking turns (the order flips every round), and it
all stops at $5.

**A good check tests what you asked for, not just what's there.** The agent can read and change the
tests in the folder, so a check it never sees is best. Keep it outside the folder:
`--check "node ~/checks/dates.mjs"`.

| Option | Default | What it does |
|---|---|---|
| `--check <command>` | required | decides pass or fail; runs in each copy after the agent |
| `--models <list>` | `sonnet,opus` | `sonnet`, `opus`, `haiku`, `fable` or any model id; `opus:high` sets one model's effort |
| `--runs <n>` | `3` | runs per model |
| `--effort <level>` | each model's own | `low`, `medium`, `high`, `xhigh` or `max` for every model |
| `--max-dollars <usd>` | `5` | no run starts once the runs have cost this much, and a run stops if it would go past it |
| `--timeout <minutes>` | `15` | a run that takes longer is stopped (it still passes if the check passes) |
| `--setup <command>` | none | runs in each copy before the agent, like `npm ci`; not timed or billed |
| `--out <folder>` | a new temp folder | where the results go |
| `--keep` | off | keep the copies, to look at what each run did |

## What you get

- A live table while it runs: each run's clock and running cost, then ✓ or ✗ from your check.
- The scoreboard: runs passed, median time, turns and output tokens, money spent, cost per passing run.
- Where the money went: new input tokens, cache reads, cache writes, output, and the thinking inside
  the output.
- In the results folder: `result.json` with every run (tokens, cost, the check's output, each tool
  call and when it happened), each run's full transcript, and a patch of what it changed.

## The agent

Every model gets the same small agent, [agent.mjs](agent.mjs): a three-line system prompt, the Read,
Edit and Bash tools, edits and commands allowed without asking, and nothing from your own setup: no
CLAUDE.md, settings files, MCP servers, plugins or skills. Only `model` and `effort` change between
lanes.

## Effort

Without `--effort`, each model runs at the default effort Claude Code gives it (the Agent SDK runs
Claude Code's engine): **medium on Opus 5.5, Sonnet 5.5 and Haiku 5.5**. On the plain Claude API,
Sonnet 5.5's default is high, so don't assume the two match. The table shows the level each lane
really ran at. To compare levels in one go: `--models sonnet,opus,sonnet:high,opus:high`.

Sources: [Claude Code model configuration](https://code.claude.com/docs/en/model-config),
[effort on the Claude API](https://platform.claude.com/docs/en/build-with-claude/effort).

## Try it on the race from the video

`example/` has the small till app from the video and its hidden check: a `--split` flag with a
rounding trap in the spec.

```
git clone https://github.com/thecoderlog/which-claude.git
cd which-claude/example/till
git init -q && git add -A && git commit -qm "the till"   # optional: the results then show what each run changed
which-claude "Add a --split flag that splits the bill between people, as described in docs/split.md. Add tests." \
  --check "node $PWD/../checks/split.mjs" --runs 5 --max-dollars 15
```

What it printed for the video (2026-10-24, on a Mac mini; which-claude 0.1.0, Agent SDK 0.3.310):

```
model        effort             passed   time   turns   tokens out   spent    per passing run
Sonnet 5.5   medium (default)   5 of 5   0:34   6       3,541        $0.283   $0.057
Opus 5.5     medium (default)   5 of 5   0:47   6       4,750        $0.747   $0.149
```

Your numbers will be different. That's why it's a tool and not a chart.

## Read the numbers honestly

- Results change from run to run. One run proves nothing, and five is still a small sample.
- A model that wins on one task can lose on yours. That's the point: measure your own.
- The costs are the Agent SDK's own count at list prices. Your Console bill is the real one.
- The running cost on screen uses [prices.mjs](prices.mjs) (checked on 2026-10-24); the cost a run
  ends with is the SDK's number.
- The agent runs shell commands without asking, in a copy of your folder. A copy is not a sandbox:
  commands can still reach the rest of your machine and the network. Use it on code you trust, ideally
  in a container or a VM.
- The copies include everything in the folder, `.env` files too. Each copy is deleted after its check
  unless you pass `--keep`.

which-claude is not made by or affiliated with Anthropic.

## License

MIT
