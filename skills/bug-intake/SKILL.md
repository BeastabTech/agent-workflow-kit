---
name: bug-intake
description: Turn a tester or user bug report into a tracked, reproduced and fixed bug - parse the report, ask for missing facts, log it in .agents/BUGS.md, reproduce it, write a failing regression test, fix with the smallest change, verify and reply to the reporter. Use when someone pastes a bug report, a screenshot description, an error from QA, or says something is broken.
---

# Bug intake to fix

## 1. Intake

Extract: title, reporter, environment and version, steps, expected, actual, frequency, severity, attachments (describe them; never paste personal data or tokens).

- Missing steps, environment or expected result? Ask the reporter once, in one numbered message.
- Search `.agents/BUGS.md` and recent commits for duplicates. Duplicate → link it and stop.
- Add a row and a section to `.agents/BUGS.md` (format in that file). Next free id `B-<nnn>`. Status `new`.

Severity: **S1** data loss, security, money, outage · **S2** main flow broken, no workaround · **S3** broken with a workaround · **S4** cosmetic.

## 2. Triage

- Find the code path (use the `explorer` agent for a wide search). Name the area owner from `docs/context/MODULE_MAP.md`.
- S1: tell the human now. Do not touch production data or config without their typed approval.
- Status `triaged`, owner set.

## 3. Reproduce

- Reproduce locally or on a dev environment with dummy data. Never on production.
- Write the reproduction as a **failing test** first (unit, integration or e2e, whichever is closest to the bug). Run it and paste the failing line. Status `reproduced`.
- Cannot reproduce: record what you tried, ask the reporter for the missing detail, status stays `triaged`.

## 4. Fix

- Smallest change that makes the test pass, following the `safe-change` skill (callers, protected files, additive only).
- Fix the root cause, not the symptom. If the same mistake exists elsewhere, list the places; fix them only if in scope.
- Run the new test, the area's tests and an old-flow smoke. Status `fixing` → `fixed (awaiting verify)` with the evidence.
- Add a `DEBUGGING.md` entry if the cause was non-obvious.

## 5. Close the loop

- Run `self-review`. Write the Done report.
- Reply to the reporter (use `team-message` if they are on another team): what was wrong in plain words, what changed, where to verify, from which build or deploy.
- After they verify: status `verified`. If it comes back, reopen the same id.

## Rules

- One bug, one branch or claim. Do not batch unrelated fixes.
- Never mark fixed without a test or a written reason why a test is not possible.
- Never send real customer data to a test or a message.
