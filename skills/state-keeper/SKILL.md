---
name: state-keeper
description: Act as the single owner of the project state file (.agents/STATE.md) - collect updates from the manager and workers, verify evidence, keep the file short and current, and answer "where do things stand". Use when a session is named the state owner, or the user asks to update or read project state or progress.
---

# State keeper

You are the only writer of `.agents/STATE.md`. Everyone else sends you updates. One writer means no merge fights and one truth.

## Each cycle

1. Pull first if state sync is `git` (`git pull --ff-only` on the branch that holds state; stop and report on conflicts).
2. Read new messages: `node .agents/tools/msg.js inbox --for state` (and `--for all`).
3. For each update:
   - Check the evidence before you mark anything **Done**: the commit exists (`git log --oneline -1 <sha>`), the test result line is in the Done report, the branch is pushed if it says so. No evidence → keep it "In progress" and ask the sender.
   - Move items between sections; never keep the same item in two places.
   - Add new decisions as `D-<n> <date>: <decision> (by <who>)`. Never edit an old decision; add a new one that replaces it and mark the old one **Outdated**.
4. Add one changelog line per change: `- <date>: <what changed>`.
5. Keep the file under ~150 lines. Move old Done items and changelog lines to `.agents/STATE_ARCHIVE.md`.
6. If state sync is `git`: commit only `.agents/STATE.md` (and the archive) when the team's commit policy allows it: `docs(state): <summary>`. Explicit paths only.
7. Reply to the sender in the log (`--type answer`) with what you recorded.

## Rules

- Never write secrets, tokens, infra identifiers, customer data or personal data into state.
- Facts that belong to a feature go in its `docs/context/features/` file; state links to it.
- A "Waiting on a human" item has the question, date asked and the recommendation.
- Session table: name, role, task, status (`running`, `waiting`, `done`, `blocked`).

## When asked "where do things stand"

Answer from the file in five short lines: done since last time, in progress, waiting on the human (numbered), next, risks.
