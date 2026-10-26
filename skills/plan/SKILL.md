---
name: plan
description: Plan a feature or change before writing code - restate the goal, read the relevant code and docs, list questions with recommendations, then give a short step plan with files, risks, tests and rollout, and wait for the owner's OK. Use for any non-trivial feature, refactor, migration or cross-service change, or when the user asks for a plan or design.
---

# Plan before code

## 1. Understand
- Restate the goal in two lines and what "done" looks like.
- Read `AGENTS.md`, the feature file, and the code you will touch yourself; an `explorer` agent only when it would take dozens of file reads (see the `delegate` skill).
- Search before you build: an existing helper, library or pattern in the repo beats new code.

## 2. Ask
If the request leaves something that matters open, run the `discover` skill first: one question at a time, two or three approaches, the user picks. For a small gap, one numbered message with every blocking question, each with your recommended answer and why. Wait.

## 3. Plan (keep it to one screen)

In a kit project fill `.agents/PLAN.md` (its sections and `Status:` line win); this block is the chat form for projects without `.agents/`.

```markdown
## Plan: <name>
Status: draft · Approved by: <the user's words, after their yes>
Goal: <one line>
Approach: <2–4 lines; why this over the obvious alternative>
Steps:
1. <step> — files: <paths> — test: <what proves it>
2. ...
Contracts touched: <APIs, events, schema; additive only>
Flag: <NAME> (default off) · Rollout: <order of deploys> · Rollback: <how>
Risks: <data, security, performance, other teams>
Parallel: <steps that can run in separate agents/worktrees; steps that must be sequential>
Agents: <count, at most `budget.js machine` at once; waves>
User stops: <where the user must decide or approve>
Out of scope: <what you will not do>
```

## 4. Wait for OK
Do not write code until the owner agrees. In a kit project save the plan in `.agents/PLAN.md` and set `Status: approved` only after their typed yes; worker agents ask the human until then. If the work splits into independent steps, offer to run them as separate agents (see the `manager` skill).
