---
name: delegate
description: Decide whether to hand work to a sub-agent (default: do it yourself), pick agent and model, keep briefs and reports small, and check the plan against spawn limits before starting. Use before spawning any sub-agent or worker, for wide searches, parallel work, or when a session uses too many agents or too much context.
---

# Delegate with a small footprint

A sub-agent has its own context window. What you gain: your context stays small. What it costs: its tokens, plus whatever you paste into the brief and read back. Delegate when the gain is bigger than the cost.

## Default: solo
Size the problem first: `node .agents/tools/budget.js triage --files <n> --read <n> --parts <n> [--risk high]` gives the mode, model tier and agent count. Delegation is the exception. Over 1-3 files or one `git grep`-sized search, do it yourself. The hook warns when you start an `explorer` in a repo under `limits.smallRepoFiles` (400) tracked files.

## Then: size the plan and check it against the limits

Before you spawn anything, write down how many agents the plan needs (workers, one reviewer, the `closer`) and how many run at once, then check it:
```bash
node .agents/tools/budget.js plan --agents <n> --parallel <p> --brief-chars <typical>
node .agents/tools/budget.js status        # during the work
```
Defaults: 4 at once, 10 per session (`limits` in `.agents/config.json`). If there is no budget tool in this project, apply those numbers yourself. **Tell the user the count and any WARNING before you start**, with your recommendation (merge tasks, run in waves, raise a limit), and wait if they must decide. The PreToolUse hook repeats the check on every spawn and asks the human when a limit would be crossed. The numbers are estimates for early warning, not a bill.

## Delegate when
- The task needs many reads or searches and you only need the conclusion (`explorer`).
- A fresh, unbiased read helps: review, security, QA (`reviewer`, `security-reviewer`, `qa-tester`).
- Tasks are independent and touch different files, so they can run in parallel.
- A side job would flood your context with output (long test logs, big diffs).

## Do it yourself when
- It is 1-3 tool calls, or a file you already know. A search that `git grep` answers in one or two calls is yours: in a measured small search, a sub-agent cost about 6.7 times the tokens and 4 times the time with no main-context saving (docs/benchmarks/delegation-small-search.md).
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

## Rules
- Never start a second agent for work an earlier one already returned; use its result.
- Reserve slots for the reviewer and the `closer`.
- Parallel agents never share files. Check `msg.js claims`.
