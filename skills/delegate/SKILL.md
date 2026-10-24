---
name: delegate
description: Decide whether to hand work to a sub-agent, and do it with the least context and cost - when to delegate, which agent and model, how small the brief and the returned report should be, how many at once, and how to check the plan against the spawn limits before starting. Use before spawning any sub-agent or worker, when a task needs wide searching or many file reads, when asked to run things in parallel, or when the session is using too many agents or too much context.
---

# Delegate with a small footprint

A sub-agent has its own context window. What you gain: your context stays small. What it costs: its tokens, plus whatever you paste into the brief and read back. Delegate when the gain is bigger than the cost.

## Delegate when
- The task needs many reads or searches and you only need the conclusion (`explorer`).
- A fresh, unbiased read helps: review, security, QA (`reviewer`, `security-reviewer`, `qa-tester`).
- Tasks are independent and touch different files, so they can run in parallel.
- A side job would flood your context with output (long test logs, big diffs).

## Do it yourself when
- It is 1-3 tool calls, or a file you already know.
- It needs the context you already hold (a decision you just made, a file you just read).
- It touches the same files as another running agent.
- The brief would be as long as the work.

## Pick the agent and model
`explorer` (cheap) to find things · `planner` to split a goal · `test-writer`, `build-fixer`, `doc-updater` for those jobs · `reviewer` / `security-reviewer` before done · `qa-tester` to test like a user · `closer` last. Cheapest model that can do the job; strong model only for design, risky or cross-cutting work.

## Brief: small and self-contained
- Goal in one or two lines, files it owns, constraints, done criteria, report size ("under 15 lines").
- Link docs and paths; do not paste files or logs. The agent can read them. Over ~6000 characters the budget hook warns.
- State what you already ruled out, so it does not repeat it.

## Get small results back
Ask for a conclusion with `file:line` pointers, not file contents. Read only the report. If it is long, ask for a shorter one rather than reading it all.

## Check the plan before you start
```bash
node .agents/tools/budget.js plan --agents <n> --parallel <p> --brief-chars <typical>
node .agents/tools/budget.js status        # during the work
```
If it prints WARNING lines, show them to the user with your recommendation (merge tasks, run in waves, raise a limit) **before** spawning. The PreToolUse hook repeats the check on every spawn and asks the human when a limit would be crossed. Limits live in `limits` in `.agents/config.json`.

## Rules
- Never start a second agent for work an earlier one already returned; use its result.
- Reserve slots for the reviewer and the `closer`.
- Parallel agents never share files. Check `msg.js claims`.
- Token numbers from the checker are estimates for early warning, not a bill.
