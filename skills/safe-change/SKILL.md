---
name: safe-change
description: Checklist for changing existing, live code without breaking what runs today - ask first, impact search, protected files, backward-compatible plan, smallest diff, verification and old-flow smoke test. Use before and after editing production code, schemas, APIs, events or config, and before saying a change is done.
---

# Safe change

Follow every step and report honestly which ones ran.

## Before editing

0. **Ask first.** List assumptions and questions in one numbered message, each with your recommendation. Wait on blocking ones. Stop and ask when something unexpected shows up.
1. **Read context:** `AGENTS.md`, the area's feature file, the owner in `docs/context/MODULE_MAP.md`, `.claude/rules/never-break.md`.
2. **Impact search** for every function, route, field, enum value, event, queue, env var or file you touch:
   ```bash
   git grep -n --untracked "<symbol>" -- <source dirs>
   ```
   Contracts used by other services or apps: search those repos too, or ask their owner.
3. **Protected files** (`protectedFiles` in `.agents/config.json`): stop, show the owner the exact diff, wait for their OK.
4. **Compatibility plan:** new request fields optional, response fields only added, columns nullable or defaulted, new behaviour behind a flag (default off), no renamed or removed public names.
5. **Claim the files** (shared mode) or confirm you are in your own worktree.

## While editing

- Smallest diff that solves the task. No drive-by refactors.
- Match the surrounding style, comment density and error messages.
- Never widen what a user can read or write.
- Side effects fail open (try/catch + log) unless they are the point of the action.
- New env vars go to `.env.example` with a safe default.

## Verify

Use the commands in `docs/context/CONVENTIONS.md` (or `.agents/config.json` → `commands`):

1. install (only if dependencies changed or are missing), type-check, build;
2. tests for what you touched, plus new tests for new code (`docs/context/TESTING.md`);
3. lint the changed files;
4. **smoke-test the old flow** you touched, not only the new one (run the app and exercise it, or run the related script with `--dry-run`).

Never trigger real external side effects (payments, emails to real people, third-party writes) while testing.

## After

- Update the feature file and any doc the `README.md` table in `docs/context/` points to; mark replaced text **Outdated**.
- Refresh `@owner` / `@summary` headers on major functions you touched.
- Run the `self-review` skill and write the Done report.
