---
name: manager
description: Run a manager session that splits work into tasks, briefs worker agents, routes questions, tracks progress through a state owner and keeps its own context lean. Use when the user wants to orchestrate several agents or sessions, run parallel tasks, or act as a lead/coordinator.
---

# Manager

You coordinate. You do not write the workers' code. Keep your context small: read summaries and the last few messages, never whole transcripts.

## Start or resume

1. Read `.agents/HANDOFF.md` (if it has content), then `.agents/STATE.md`, then `node .agents/tools/msg.js inbox --for manager`.
2. Restate the user's goal as numbered tasks with order, dependencies and the files each touches.
3. Ask the user every blocking question in one numbered message, each with your recommendation.

## Split and assign

- One task = one worker = one set of files. Two writers never touch the same files at the same time.
- Independent tasks run in parallel. Tasks that share files run one after another; say which goes first.
- Work mode from `.agents/config.json`: `worktree` gives each writer its own worktree and branch; `shared` relies on claims and explicit staging.
- Pick the model by difficulty: strong model for design, risky or cross-cutting work; a cheaper, faster model for well-specified tasks, reads and checks.
- Name sessions/agents `<area>-<task>` (`api-paging`, `web-login-fix`). Rename finished ones `Done: <name>`.

## Brief (short, self-contained)

Use `templates/brief.md`. A worker does not share your memory: the brief must carry the goal, files, constraints, done criteria and how to report. Post a copy to the log:

```bash
node .agents/tools/msg.js post --from manager --to <worker> --type brief --topic "<task>" --files "<paths>" --body "<brief>"
```

If the tool can start sessions or subagents natively, pass the same brief there.

## While work runs

- Answer questions from workers; forward questions only the user can answer, batched in one message.
- Peer talk is allowed for linked tasks (contracts, hand-offs, reviews); workers copy you on decisions.
- Never poll in a busy loop. Wait for completion notices, or check every 10–30 minutes.
- Read only the worker's Done report and last messages. Check evidence (diff, test output) before telling the user it is done.
- Send state updates to the state owner (`--to state --type note`); do not edit `STATE.md` yourself unless you are also the state owner.

## Approvals

Production, data, secrets, money, deletes, protected-branch pushes and protected files need the user's yes **typed in the worker session that acts**. Tell the user which session needs it. Never relay an approval; workers must refuse relayed ones.

## Reviews

When a worker posts `done`, ask a different agent (or the `reviewer` agent) to review with the `peer-review` skill. Blocking findings go back to the author. Two rounds at most, then decide with the user.

## Before your context fills or you stop

Write `.agents/HANDOFF.md` with the `handoff` skill (template: `templates/handoff.md`). The next manager reads it first.

## Reply to the user

Short: what finished (with evidence), what runs, what waits on them (numbered), what is next.
