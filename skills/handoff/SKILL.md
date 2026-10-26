---
name: handoff
description: Write a hand-off note before a context reset, a session switch, the end of the day or a change of direction, and resume from one at the start of a session. Use when the user says hand off, wrap up, save progress, compact, resume, continue where we left off, or when your context is getting full.
argument-hint: "[write|resume]"
---

# Hand-off and resume

Mode: `$ARGUMENTS` (default: `write` if you have done work this session, `resume` if you just started).

## Write

Replace `.agents/HANDOFF.md` (keep it under ~60 lines; a manager uses `skills/manager/templates/handoff.md` instead):

```markdown
# Hand-off (<date time, zone>) — <session name / role>

## Goal
<the user's goal in one or two lines>

## Done this session (with evidence)
- <item> — <commit sha / test result line / file>

## In progress
- <task> — <branch or worktree> — <files touched> — <exact next step>

## Uncommitted work
<`git status --short` summary: which files are yours, which belong to others>

## Decisions and answers from the user
- <decision> (<date>)

## Open questions (with recommendation)
1. ...

## Traps
- <commands never to run here, env quirks, protected files, flaky tests>

## Resume with
1. Read this file, then `.agents/STATE.md`, then `msg.js inbox --for <name>`.
2. <first concrete command or file to open>
```

Then:
- Post a `note` to the state owner with the same summary (`--to state`).
- Release claims you will not finish (`--type release`), or say in the note that you keep them.
- Do not commit unless asked. If state sync is `git` and commits are allowed, commit only `.agents/HANDOFF.md`.

## Resume

1. Read `.agents/HANDOFF.md`, then `.agents/PLAN.md` (is it approved, which tasks are open), then `.agents/STATE.md`, then your inbox.
2. Run `git status --short` and `git log --oneline -5`; compare with the note. If they disagree, trust git and say so.
3. Re-check every claim the note says you hold (`msg.js claims`).
4. Tell the user in three lines: where things stand, what you will do next, what you need from them. Then continue.
