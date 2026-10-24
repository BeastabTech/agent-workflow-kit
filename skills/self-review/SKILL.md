---
name: self-review
description: Review your own change as a strict reviewer before calling it done (correctness, security, edge cases, tests, docs), then write a Done report with real evidence and what was not run. Use before saying done, fixed or shipped, and before asking for a review or commit.
---

# Self-review and Done report

## 1. Look at the real diff

```bash
git status --short
git diff --stat && git diff
git diff --cached --stat   # if anything is staged
```

Only review what you changed. If you see changes that are not yours, leave them alone and mention them.

## 2. Go through the checklist

Use `docs/context/SELF_REVIEW.md` if the project has it; otherwise this short list:

- **Correctness:** does it do what was asked, including the unhappy paths? Every caller of a changed symbol still works?
- **Compatibility:** additive only; with new flags off, old behaviour is identical.
- **Security:** auth and permission on every new entry point; data scoped to the caller; input validated; no secrets, tokens or personal data in code, logs, responses or docs.
- **Concurrency:** double submit, two instances, retries, out-of-order events.
- **Edge cases:** empty, null, huge, unicode, time zones, money rounding, deleted or inactive records, external timeouts.
- **Tests:** new code has tests; the bug has a regression test; tests fail without the fix.
- **Shape:** small functions and files, no needless abstraction, no dead code or debug prints.
- **Docs:** feature file, debugging notes, env example, owner headers.

Fix what you find, then re-run the checks.

## 3. Collect evidence

Run the project's commands (`docs/context/CONVENTIONS.md`). Keep the exact result lines. If a command cannot run, record why.

## 4. Write the Done report

Template: `templates/done-report.md` in this skill (same as `docs/context/DEFINITION_OF_DONE.md`). Rules:
- Paste real result lines. Never turn a failure or a skipped check into a pass.
- A required check that could not run makes it "done except X".
- List open `@todo` / `@question` items and approvals used.

For a second opinion, ask the `reviewer` agent (or another session with `peer-review`) and include its blocking findings and your fixes.
