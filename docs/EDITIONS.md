# Editions

One choice at install time sets how much the kit does. Pick the edition that matches the work, not the biggest one.

| Edition | For | Hooks | Skills loaded every session | Delegation | Reply style |
|---|---|---|---|---|---|
| `lite` | Small projects, quick fixes, anyone who wants only the safety net | `minimal`: secrets, AI trailers, force-push, destructive database | 5 core (exported, no plugin) | solo | normal |
| `low-tokens` | Cutting cost; long sessions on a budget | `standard` | 9 core (exported, no plugin) | solo; at most 2 agents even on a big problem | caveman-lite |
| `normal` | Default | `standard` | all (plugin) | by problem size | normal |
| `auto` | Let the kit decide per task | `standard` | all (plugin) | sized per task: small work like low-tokens, medium like normal, big or risky like best | normal |
| `best` | Work you want reviewed hard | `strict` | all (plugin) | by problem size, plus done gate, independent review and closeout | normal |

## How to choose

- **Plugin:** the install prompt asks for `preset` (and you can change it later in the plugin options, or per shell with `AWK_PRESET=best`).
- **Project files:** `node scripts/init-project.js --target <dir> --preset <name>`. Run without `--preset` in a terminal and it asks. The `init` skill asks as its first question.
- **Team default:** `preset` in `.agents/config.json`. Precedence: `AWK_PRESET`, plugin option, config file, `normal`.

`lite` and `low-tokens` write a compact `AGENTS.md` (about 300 tokens instead of 1k), skip the `docs/context` pack, the rules folder and the generated agent definitions, add the git hooks, and export only their core skills. Do not enable the plugin with them: the plugin lists every skill (about 3.8k tokens).

## `auto`: the kit decides

With `auto` nobody picks numbers. The agent runs `node .agents/tools/budget.js triage --task "<request>"`: the kit reads the task words (paths, list items, "and also ...", risky words such as auth, payment, migration, delete, production) and counts matching files with `git grep`, then sizes the task and picks the mode, model tier and review. Small work behaves like `low-tokens`, medium like `normal`, big or risky like `best`. The estimate is a heuristic; the agent can override any number (`--files --read --parts --risk`).

## Loops

Repeating work (fix until green, review and fix, retry, watch) goes through the `loop` skill and `node .agents/tools/loop.js`. A loop has a check command, a round limit (`limits.maxLoopRounds`, 8) and a stuck rule (same failure twice stops it), so it cannot run away. Recurring or watch jobs use Claude Code's `/loop <interval>` with an end condition.

## Size first, then mode

Every edition starts the same way: size the problem, then pick the mode, model and agent count.

```bash
node .agents/tools/budget.js triage --files 2 --read 5 [--parts 1] [--risk high]
```

| Size | Normal | low-tokens | best |
|---|---|---|---|
| S: 1-3 files | solo, small model | solo, small model | solo, self-review |
| M: up to 8 files | solo or one helper, mid model | solo, small model | one helper, strong model, independent reviewer |
| L: parts | a worker per part (max 4), mid model | 2 workers at most | workers, strong model, reviewer |
| XL: big and split | planner, workers, closer | 2 workers at most | planner, workers, reviewer, closer |

Risky areas (auth, payments, data, deletes, migrations) always get an independent reviewer and never a small model.

## Do the editions help?

Not measurably so far. On real tasks in a small and a large project the editions were within noise of using no kit, for both tokens and hidden-test results; see [benchmarks/real-tasks.md](benchmarks/real-tasks.md). What the kit does give you is deterministic: the safety hooks, the done gate, project memory and hand-off. Pick `lite` or `low-tokens` if you only want those without the overhead.

## Measuring editions

`node scripts/bench-presets.js` runs one task under no kit, `lite`, `low-tokens`, `normal` and `best`, and prints hidden-test score, tokens, time and cost per edition. See [BENCHMARK.md](BENCHMARK.md). No result is published until it has been run.
