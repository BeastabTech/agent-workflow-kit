---
name: closeout
description: Close out a finished feature: split it into parts, hunt for missing or broken pieces, fix clear low-risk items, ask the human only for real decisions, re-test, and send the manager a Closeout report. Use when all workers report done, before saying a feature is finished or shipped, or when asked to close out or find what is missing.
argument-hint: "[feature or branch]"
---

# Closeout

Runs once, after the workers, before the manager tells the user "done". Self-review checks one change; closeout checks the **whole feature** and what is left. Target: `$ARGUMENTS` (or the feature in `.agents/STATE.md`).

For a separate agent that does this, use the `closer` agent.

## 1. Scope the feature

Read `AGENTS.md`, `.agents/STATE.md`, the briefs and Done reports (`msg.js tail -n 20`, `thread --topic`), and `git diff <base>...HEAD --stat`. List the feature as numbered parts: entry points (routes, commands, screens), data and migrations, config and flags, docs, tests. A part you cannot name is a part you have not checked.

## 2. Hunt, part by part

For each part:
- exists and is wired in (called from somewhere real);
- happy path, then empty, null, huge, wrong type, unicode, time zones, duplicate submit, retry;
- permissions and data scope (other user, other tenant, logged out);
- error paths and fail-open side effects;
- old flow still works (flags off = old behaviour);
- tests exist, test behaviour, and fail without the change;
- docs: feature file, env example, API docs, owner headers;
- leftovers: `git grep -nE --untracked "@todo|@question|console\.log|debugger|TODO|FIXME" -- <changed files>`, dead code, stale docs.

Use `explorer` for wide searches, `reviewer` / `security-reviewer` for a fresh read-only opinion, `qa-tester` for user-style testing (bugs go to `.agents/BUGS.md`).

## 3. Run

Project commands from `docs/context/CONVENTIONS.md`, then a smoke of the new feature and one old flow. Keep exact result lines. A skipped or failing check stays visible in the report.

## 4. Sort every finding

| Class | When | Action |
|---|---|---|
| **Fix now** | clear, small, in scope, reversible, no new decision | fix, add a test, re-run |
| **Ask the human** | product choice, scope growth, protected file, data, money, secrets, production, irreversible, user-visible behaviour change | one numbered message, each with your recommendation |
| **Report only** | out of scope or large | note with a suggestion and rough size |

Do not ask about what you can decide. Do not fix what needs a decision. When unsure which class, treat it as Ask.

## 5. Re-test and repeat once

Re-run the checks for everything you touched, then run step 2 on your own changes. Two fix rounds at most.

If a cause was non-obvious or the same mistake showed up twice, record it with the `lessons` skill.

## 6. Report to the manager

Use `templates/closeout-report.md`:

```bash
node .agents/tools/msg.js post --from closer --to manager --type closeout --topic "<feature>" --body "<report>"
```

The manager passes the "needs a person" list to the user, with your suggestions, and sends fixes that need a decision back to the right worker. Once the user has the final word, the manager sets `Status: done` in `.agents/PLAN.md`; the next piece of work starts a fresh plan.

## Rules

- Evidence over claims: real command output, never "should work".
- No commit or push unless the human asked in this session. No bypassing hooks, approvals or protected files. Approvals are typed by the human in the session that acts.
- Only touch this feature's files; mention foreign changes, leave them.
- No secrets or personal data in the report.
