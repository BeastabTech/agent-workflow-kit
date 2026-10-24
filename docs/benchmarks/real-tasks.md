# Editions on real tasks (measured)

**Setup.** Two projects: a small module (about 100 lines, public fixture in `benchmarks/fixtures`) and a large monolith (about 1,400 files, private; task names are anonymised in the raw file). Nine tasks in total, each from real history or written like a maintainer's request: the agent starts from the state before the fix, gets a plain request, and is scored by hidden tests it never sees (copied in after it finishes) plus the project's own suite. Model `sonnet`, 3 runs per task and edition, each in a throwaway worktree. Tokens come from the session transcripts; "fresh" = input + cache writes + output. Money is not shown because prices change. Harness: `scripts/bench-real.js`, summary: `scripts/bench-summary.js`, raw rows: [real-tasks.raw.json](real-tasks.raw.json).

**big project, L task** (big-L-6; 3 runs for no kit)

| Edition | All hidden tests pass | Hidden tests passed | Fresh tokens | vs no kit | Output tokens | Turns |
|---|---|---|---|---|---|---|
| no kit | 100% (3/3) | 100% | 73k |  | 5k | 6 |
| lite | 100% (3/3) | 100% | 74k | +1% | 5k | 7 |
| low-tokens | 100% (3/3) | 100% | 74k | +1% | 5k | 7 |
| auto | 100% (3/3) | 100% | 79k | +8% | 6k | 8 |
| normal | 100% (3/3) | 100% | 77k | +5% | 5k | 7 |
| best | 100% (3/3) | 100% | 80k | +9% | 7k | 6 |

**big project, M task** (big-M-3, big-M-4, big-M-5; 9 runs for no kit)

| Edition | All hidden tests pass | Hidden tests passed | Fresh tokens | vs no kit | Output tokens | Turns |
|---|---|---|---|---|---|---|
| no kit | 33% (3/9) | 77% | 67k |  | 7k | 10 |
| lite | 33% (3/9) | 77% | 63k | -7% | 7k | 9 |
| low-tokens | 44% (4/9) | 82% | 62k | -9% | 6k | 9 |
| auto | 33% (3/9) | 77% | 65k | -4% | 6k | 8 |
| normal | 44% (4/9) | 79% | 66k | -2% | 6k | 9 |
| best | 33% (3/9) | 77% | 69k | +2% | 7k | 11 |

**big project, S task** (big-S-1, big-S-2; 6 runs for no kit)

| Edition | All hidden tests pass | Hidden tests passed | Fresh tokens | vs no kit | Output tokens | Turns |
|---|---|---|---|---|---|---|
| no kit | 100% (6/6) | 100% | 68k |  | 5k | 9 |
| lite | 100% (6/6) | 100% | 70k | +2% | 5k | 8 |
| low-tokens | 100% (6/6) | 100% | 70k | +3% | 5k | 10 |
| auto | 83% (5/6) | 97% | 73k | +6% | 4k | 8 |
| normal | 100% (6/6) | 100% | 74k | +8% | 5k | 9 |
| best | 100% (6/6) | 100% | 74k | +9% | 5k | 9 |

**small project, L task** (cart-checkout; 3 runs for no kit)

| Edition | All hidden tests pass | Hidden tests passed | Fresh tokens | vs no kit | Output tokens | Turns |
|---|---|---|---|---|---|---|
| no kit | 100% (3/3) | 100% | 30k |  | 7k | 6 |
| lite | 100% (3/3) | 100% | 32k | +5% | 7k | 7 |
| low-tokens | 100% (3/3) | 100% | 28k | -7% | 6k | 6 |
| auto | 100% (3/3) | 100% | 36k | +20% | 7k | 11 |
| normal | 100% (3/3) | 100% | 36k | +21% | 7k | 10 |
| best | 100% (3/3) | 100% | 40k | +33% | 8k | 12 |

**small project, M task** (cart-coupons; 3 runs for no kit)

| Edition | All hidden tests pass | Hidden tests passed | Fresh tokens | vs no kit | Output tokens | Turns |
|---|---|---|---|---|---|---|
| no kit | 0% (0/3) | 83% | 27k |  | 5k | 6 |
| lite | 0% (0/3) | 79% | 27k | 0% | 6k | 6 |
| low-tokens | 0% (0/3) | 83% | 27k | -1% | 5k | 6 |
| auto | 0% (0/3) | 83% | 34k | +25% | 6k | 10 |
| normal | 0% (0/3) | 83% | 36k | +33% | 6k | 11 |
| best | 0% (0/3) | 83% | 37k | +36% | 7k | 13 |

**small project, S task** (cart-remove; 3 runs for no kit)

| Edition | All hidden tests pass | Hidden tests passed | Fresh tokens | vs no kit | Output tokens | Turns |
|---|---|---|---|---|---|---|
| no kit | 0% (0/3) | 80% | 16k |  | 1k | 3 |
| lite | 0% (0/3) | 80% | 21k | +30% | 3k | 7 |
| low-tokens | 0% (0/3) | 80% | 21k | +29% | 3k | 6 |
| auto | 0% (0/3) | 80% | 28k | +75% | 3k | 10 |
| normal | 0% (0/3) | 80% | 28k | +73% | 3k | 10 |
| best | 0% (0/3) | 80% | 30k | +87% | 4k | 13 |

**Overall:** no kit: 56% all-pass, 54k fresh tokens per run (27 runs); lite: 56% all-pass, 54k fresh tokens per run (27 runs); low-tokens: 59% all-pass, 53k fresh tokens per run (27 runs); auto: 52% all-pass, 57k fresh tokens per run (27 runs); normal: 59% all-pass, 58k fresh tokens per run (27 runs); best: 56% all-pass, 60k fresh tokens per run (27 runs)

## Result

- **No edition improved the hidden-test result beyond noise**, in the small project or the large one. Tasks that every edition missed, they all missed the same way (the same edge case).
- **Tokens:** within about ±10% of no kit on the large project; 20 to 90% higher on the small project for `auto`, `normal` and `best` (the done gate makes the agent run tests it would otherwise skip, and the tests pass). `lite` and `low-tokens` stay close to no kit.
- The `best` edition wrote more tests of its own and still missed the same edge cases.
- Advice text alone did not change behaviour: agents did not run the kit's skills, the triage command or reviewers on their own in these runs.

## Other measurements

- Same large-project tasks, no kit, different models, 1 run each: `haiku` and `opus` passed all 5, `sonnet` 3 of 5. The model choice moved results more than any edition did. One run each, so only a signal.
- A sub-agent on a small search cost about 6.7 times the tokens for the same answer ([details](delegation-small-search.md)).

## Limits

One model, three runs per cell, tasks with unit-test scoring only. It says nothing about work the tests cannot score (design, security review, hand-off between sessions), or about much larger tasks than these.
