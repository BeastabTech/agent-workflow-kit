# Measuring what the kit does for you

The kit costs context (see "Measured impact" in the README) and claims to save rework and keep the manager's context small. This page is how to check that on your own work, and how to share a result.

## What can be measured

| Question | Tool | Reliable? |
|---|---|---|
| What does the kit load in every session? | `npm run stats` | yes (estimate: characters / 4) |
| How many tokens did a session use, main conversation vs sub-agents? How big did the context get? | `node scripts/session-stats.js --latest` | yes, from the usage Claude Code records |
| Was the output better? | you, with a rubric | only as good as the rubric; needs several runs |
| Is it faster or cheaper overall? | wall time + `session-stats.js` totals | one run is noise; use at least 3 per arm |

## Results so far

- [Delegation on a small search](benchmarks/delegation-small-search.md): the sub-agent cost about 6.7 times the tokens and 4 times the time, with no main-context saving. Harness: `node scripts/bench-delegation.js --repo <dir>` (spends real tokens).
- [Editions on one coding task](benchmarks/presets-coupons.md): `normal` and `best` passed 7/8 hidden tests every run vs 6.3 average with no kit, for 20-40% more tokens; `lite` and `low-tokens` in between. Harness: `node scripts/bench-presets.js --runs 3`.
- Plugin evals (`claude plugin eval`, 1 run each): `closeout-fires` with the kit 1.00, without 0.00; `delegate-fires` with 1.00 (2 of 3 judge votes), without 0.00. Summary in the README.

## Protocol (A/B on one task)

1. Pick a task with a clear finish line (a feature with acceptance criteria, or a bug with a known cause). Write the acceptance criteria down before you start.
2. **Arm A (baseline):** a fresh session, the kit plugin disabled, same repo state, same prompt.
3. **Arm B (kit):** a fresh session with the plugin and `init` already run, same prompt, "use the manager workflow" added.
4. Repeat each arm at least 3 times. Reset the repo between runs (`git stash -u` or a fresh worktree).
5. For each run record: `node scripts/session-stats.js <session.jsonl> --json` (fresh tokens main and sub-agents, peak context, sub-agent count), wall time, and the rubric score.

## Rubric (score each 0-2, same grader for both arms, ideally blind)

1. Acceptance criteria met (tested, not claimed).
2. Old behaviour still works (a smoke test exists and passes).
3. No missed edge case from a list you wrote in advance (empty, other user, retry, time zone).
4. Tests exist and fail without the change.
5. Docs and env example updated.
6. The final report is honest: it lists what was not run.

## What to report

Task size, model, number of runs per arm, the table of medians (fresh tokens main / sub-agents, peak context, wall time, rubric score), and what went wrong. Say plainly when the kit made things worse. Open an issue with the "Benchmark result" template or a pull request adding a row to a results file under `docs/benchmarks/`.

## Expectations

- Peak **main** context should fall when work is split (the manager reads reports, not code). Total tokens usually rise because each sub-agent loads its own context. Judge the trade by the rubric score and rework, not by tokens alone.
- Small, single-file tasks usually do better without the manager workflow. The `delegate` skill says the same.
