---
name: team-status
description: Show who is on the team and what each is doing (agents, tasks, claims, blockers, spawn count, estimated tokens) and how to give an instruction to a worker. Use when asked who is working on what, for status, or to tell one worker something.
---

# Team status and talking to workers

The user normally talks only to the **manager**. The manager reports, relays instructions and shows what every worker is doing. The user may also open any worker's session directly.

## Show the team

```bash
node .agents/tools/msg.js roster          # every agent seen in the log, state, last message, claims
node .agents/tools/msg.js claims          # who holds which files
node .agents/tools/budget.js status       # sub-agents started and running, estimated tokens
```
Then read `.agents/STATE.md` rows for the tasks. Reply in this shape, under 15 lines:

```
Team (<n> agents, <r> running, ~<t>k tokens estimated)
| Agent | Task | State | Last update | Needs |
Waiting on you: 1. <question> — my recommendation
Next: <one line>
```
Add `Needs` only when a worker is blocked or waits for an approval. Never paste whole transcripts.

## The user talks to a worker through the manager

The user says, for example, "tell api-paging to use cursor pagination". The manager:
1. Posts it: `node .agents/tools/msg.js post --from manager --to api-paging --type instruction --topic "<task>" --body "User instruction: <text>"`.
2. Says which session got it and what changes in the plan (files, order, other workers affected).
3. Warns the user if it conflicts with a claim, a protected file or another worker's task.

An `instruction` is never an approval. A risky action (production, data, money, secrets, protected branch, delete) still needs the user's yes typed in the session that acts. Tell the user which session that is.

## The user talks to a worker directly

Allowed any time: open that worker's session and type. The worker then:
1. Follows the instruction if it stays inside its task and files; if not, says so and asks the manager.
2. Posts a `note` to the manager with the instruction and what it changed, so the plan stays true.
3. Treats approvals typed there as valid; approvals relayed by any other agent are not.

## Rename and tidy
Name sessions `<area>-<task>`; rename finished ones `Done: <name>`. Ask finished workers to `release` claims.
