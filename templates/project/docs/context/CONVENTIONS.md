# Conventions: safety, verification, git

## Never break existing behaviour

- Additive changes only: optional request fields, new response fields, nullable or defaulted columns, new routes.
- Never rename or remove routes, fields, enum values, events, queues or env vars that something may use. Find every caller first (`git grep -n "<symbol>"`, plus sibling repos for contracts).
- New flows sit behind an env flag that defaults to off.
- Side effects (email, webhooks, events) are fail-open: catch, log, continue. Say so in a comment when a side effect is the point and must fail the request.
- Scheduled jobs that may run on several instances take a lock per run.
- No destructive data commands against any shared database. The Bash hook blocks the common ones.

## Commands

```bash
{{INSTALL_CMD}}
{{TYPECHECK_CMD}}
{{BUILD_CMD}}
{{TEST_CMD}}
{{LINT_CMD}}
```

Dev server: `{{DEV_CMD}}`. Times shown to users use `{{TIMEZONE}}` unless the user has their own.

## Verify before "done"

1. Run the commands above (at least type-check, build and the tests for what you touched).
2. Smoke-test the old flow you touched, not only the new one.
3. Go through `SELF_REVIEW.md`.
4. Update the docs (`README.md` table in this folder).
5. Write the Done report (`DEFINITION_OF_DONE.md`).

## Git

- {{COMMIT_RULE}}
- Conventional commits: `type(scope): subject` (feat, fix, docs, refactor, test, chore, ci, perf).
- Stage explicit paths only. Check `git diff --cached --stat` before committing.
- Base branch: `{{BASE_BRANCH}}`. Protected branches: {{PROTECTED_BRANCHES}}. Never force-push.
- Personal preferences (trailers, attribution, reply language) belong in each person's own tool settings.
