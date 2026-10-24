---
name: loop
description: Run repeating work safely - fix until the tests pass, review and fix, retry a flaky step, or watch something on an interval - with a round limit, a stuck detector and a cheap model per round. Use when asked to loop, keep trying, fix until green, repeat until it works, poll or watch something, or when the same fix has failed twice.
---

# Loop with a hard stop

A loop that cannot stop burns tokens. Every loop here has a goal, a check that a command can answer, a round limit and a stuck rule. `loop.js` enforces them; you do not judge your own progress.

## Pick the kind

| Kind | Check | Rounds | Model |
|---|---|---|---|
| Fix until green | the test, type or lint command | 8 | small or mid; strong only if stuck |
| Review and fix | the `reviewer` says "no blocking findings" | 2 to 3 | the reviewer independent of the author |
| Retry a flaky step | the step's exit code | 3 | small |
| Watch or recurring (CI, deploy, queue) | a status command | by time, not rounds | small; use Claude Code `/loop <interval> <prompt>` and end it when the status is final |

Size the work first (`node .agents/tools/budget.js triage --task "..."`). If the problem is big, split it and loop on one part at a time.

## Run it

```bash
node .agents/tools/loop.js start --name fix-tests --check "npm test" --goal "all tests pass"
# change something specific, then:
node .agents/tools/loop.js check --name fix-tests
```

`check` runs the command and prints one verdict:
- `DONE`: report the evidence (command and result line) and stop.
- `CONTINUE`: change something specific and different, then `check` again.
- `STOP`: the round limit is reached, or the same failure repeated (stuck). Do not start another round. Summarise what you tried and ask the user, or change the approach and start a new loop only with their say.

No check command (a review loop, a watch)? Record rounds yourself: `loop.js step --name <n> --result pass|fail --sig "<error text>" --note "<what changed>"`. Same verdicts.

## Each round
1. Read only the failure output tail, not the whole log.
2. Say in one line what you think is wrong and what you change. A change you cannot explain is a guess; two guesses in a row mean stop and re-read.
3. One change per round. Never weaken or delete a test, add a skip, or loosen a check to make it pass.
4. Do not fix what is outside the goal.

## Recurring and watch loops
- Use `/loop <interval> <prompt>` in Claude Code, or a scheduled run in other tools. Put the end condition in the prompt ("stop when CI is green or red") and have the agent end the loop when it is met.
- Pick the longest interval that still meets the need. Each tick that finds nothing new should cost one short status call, not a re-read of the project.
- Never run a watch loop unattended against production, data or money. Those need a human's typed yes each time.

## Limits
`limits.maxLoopRounds` (8) and `limits.stuckRepeats` (2) in `.agents/config.json`. `loop.js status` lists loops.
