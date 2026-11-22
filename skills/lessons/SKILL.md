---
name: lessons
description: Turn a bug, incident or failed review into a short lasting lesson in the project docs (trap, how to spot it, fix) without duplicates or secrets; propose a rule only if it recurs. Use after a non-obvious bug is fixed, when the same mistake appears twice, or when asked to record or learn from what happened.
---

# Lessons

A lesson is worth writing only if a future agent would otherwise repeat the mistake. Skip anything the code or `git log` already shows.

## 0. First ask: can a check stop it instead?

A written lesson only helps if the next agent reads it and obeys it. A check works every time. Before writing anything, go down this list and stop at the first that fits:

1. **A check that fails:** a test, a type, a lint rule, a hook or a CI step that goes red when the mistake is made. Write its message so it names the fix, not only the fault ("use `db.transaction()` here, see `src/db/tx.ts`").
2. **A design where the mistake cannot be made:** remove the dangerous option from the API, make the wrong value unrepresentable in the type, move the code so the wrong import is not possible.
3. **Delete the bad example:** if the mistake was copied from old code, remove or fix that code. Agents copy what they find.
4. **Only then a written lesson** (below), and a rule last of all.

Say in your report which level you reached and why not a higher one.

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
A lesson that bit twice, or that could cause data loss or a security problem, needs more than a note. Try section 0 again first (a check or a design change); if neither is possible, it becomes a rule: draft one line for `.claude/rules/never-break.md` or `AGENTS.md` golden rules, show the owner, wait for the yes. Do not edit protected files without it.

## 5. Keep the docs small
A doc over about 150 lines gets split. Delete lessons the code now makes impossible. Tell the state owner (`msg.js post --to state --type note`) when you added or promoted one.
