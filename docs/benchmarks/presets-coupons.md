# Editions on one task (measured)

**Task:** add coupons (`applyCoupon`) to a tiny cart module ([fixture](../../benchmarks/fixtures/cart)). The prompt is deliberately short, like a real request. **Quality** = how many of 8 hidden acceptance tests pass (the agent never sees them: rounding, expiry, one coupon per cart, never below zero, invalid coupons, coupon applies to later cart changes). Model `sonnet`, 3 runs per arm, fresh repo each run, numbers from the session transcripts. Harness: `node scripts/bench-presets.js --runs 3`. Raw rows: [presets-coupons.raw.json](presets-coupons.raw.json).

| Median of 3 | no kit | lite | low-tokens | normal | best |
|---|---|---|---|---|---|
| Hidden tests passed (of 8), each run | 7, 6, 6 | 7, 7, 6 | 7, 6, 7 | 7, 7, 7 | 7, 7, 7 |
| Tests the agent wrote itself | 5 | 6 | 6 | 6 | 12 |
| Fresh tokens | 25.6k | 32.5k | 27.8k | 32.2k | 36.9k |
| Cost | $0.115 | $0.154 | $0.122 | $0.139 | $0.161 |
| Wall time | 34 s | 47 s | 35 s | 37 s | 43 s |
| Sub-agents used | 0 | 0 | 0 | 0 | 0 |

**Read it honestly.**
- `normal` and `best` passed 7 of 8 every time; no kit passed 6 or 7 (average 6.3). That is a small gain (about one hidden test) for 20 to 40 percent more tokens and cost. `lite` and `low-tokens` sit in between; with 3 runs the difference between them is noise.
- `best` wrote twice as many tests, but they did not catch the one hidden case that every arm missed. More tests is not the same as more correct.
- The task is small: no arm used a sub-agent, and the size step correctly kept everything solo. So this measures the cost and effect of the rules and the session note, not of delegation.
- One task, one model, three runs. It does not show whether `best` pays off on a larger or riskier task. That is the next benchmark to add (multi-file, with a security trap).
