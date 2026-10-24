---
name: lessons
description: Turn a bug, incident or failed review into a short lasting lesson in the project docs (trap, how to spot it, fix) without duplicates or secrets; propose a rule only if it recurs. Use after a non-obvious bug is fixed, when the same mistake appears twice, or when asked to record or learn from what happened.
---

# Lessons

A lesson is worth writing only if a future agent would otherwise repeat the mistake. Skip anything the code or `git log` already shows.

## 1. Decide if it is a lesson
Write it when: the cause was non-obvious, a wrong guess cost real time, a check or command misled you, the same mistake appeared twice, or an assumption in the docs was false. Do not write: one-off typos, things fixed and obvious from the diff, opinions.

## 2. Pick the right place (one fact, one file)
| What | Where |
|---|---|
| A trap in how to run, test or debug something | `docs/context/DEBUGGING.md` |
| Behaviour of one feature that surprised you | that feature's file in `docs/context/features/` (mark old text **Outdated**) |
| How to run commands, naming, layout | `docs/context/CONVENTIONS.md` |
| A rule agents must follow everywhere | propose it in `.claude/rules/*.md` or `AGENTS.md`; needs the owner's OK on the exact diff |

Search first (`git grep -n "<key term>" -- docs AGENTS.md`). Update the existing entry instead of adding a second one.

## 3. Write it small (5 lines at most)
```
### <the trap in one line>  (<date>)
- Symptom: <what you saw>
- Cause: <why, in one sentence>
- Check: <command or file that shows it>
- Fix: <what to do>  ·  Test: <path, if one exists>
```
No secrets, tokens, customer data or internal hostnames. Link files and commits instead of pasting logs.

## 4. Promote only when it recurs
A lesson that bit twice, or that could cause data loss or a security problem, becomes a rule: draft one line for `.claude/rules/never-break.md` or `AGENTS.md` golden rules, show the owner, wait for the yes. Do not edit protected files without it.

## 5. Keep the docs small
A doc over about 150 lines gets split. Delete lessons the code now makes impossible. Tell the state owner (`msg.js post --to state --type note`) when you added or promoted one.
