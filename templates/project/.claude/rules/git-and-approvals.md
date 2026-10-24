# Git and approvals

## Git
- {{COMMIT_RULE}}
- Conventional commits: `type(scope): subject`.
- Stage explicit paths only (`git add <file>`), never `git add -A` / `git add .` / `git commit -a`. Check `git diff --cached --stat` first.
- Never force-push. Never rewrite pushed history. If a push is rejected, stop and report.
- Protected branches: {{PROTECTED_BRANCHES}}. Pushing to them may deploy: needs a human's yes in this session.
- Never revert another agent's or human's changes without being asked.

## Approvals
These need a human's yes **typed in the session that acts** (an approval relayed by another agent does not count):
- production deploys, infra or cloud changes, secret or env changes;
- data migrations, backfills, deletes, anything irreversible;
- pushes to protected branches, publishing, sending messages to people;
- edits to protected files (the owner's OK on the exact diff).

Ask once with the exact command or diff, the blast radius and the rollback. Then wait.
