---
name: debug
description: Find the root cause of a bug or production symptom methodically - reproduce, read logs and code read-only, form and test one hypothesis at a time, fix the cause, and record symptom, cause and check in DEBUGGING.md. Use when something fails, errors, hangs, is slow, behaves differently between environments, or a test is flaky.
---

# Debug

## 1. Pin the symptom

Exact error text, where (env, version, user type), since when, how often. Check `docs/context/DEBUGGING.md` for a known entry first.

## 2. Reproduce, smallest first

Local with dummy data → failing test → dev environment. Production: read-only (logs, metrics, read queries) and only with access the human gave you. Never change production to "see what happens".

## 3. Narrow down

- Read the code path end to end; note every assumption.
- `git log -p --since=<date> -- <paths>` for recent changes; `git bisect` when a known-good version exists.
- One hypothesis at a time. Predict what you will see, run one check, compare. Write down what each check ruled out.
- Add temporary logging only locally; remove it before you finish.

## 4. Fix the cause

Write the failing test, fix the root cause (not the symptom), run the `safe-change` verification. If the same pattern exists elsewhere, list the places.

## 5. Record it

Add to `docs/context/DEBUGGING.md`:

```markdown
### <symptom as a user or log would say it> (<date>)
- Cause: <root cause>
- Check: `<read-only command>` → <healthy result>
- Fix: <commit or doc link>
```

No secrets, tokens, customer data or infra identifiers in the entry.
