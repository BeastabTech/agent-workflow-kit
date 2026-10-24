---
name: git-workflow
description: Team-safe git - branches or worktrees per task, explicit staging, conventional commits without AI attribution, no force-push, protected branches, clean hand-offs between agents sharing a checkout. Use when committing, branching, creating worktrees, pushing, opening a PR, or resolving a conflict.
---

# Git workflow

## Before you commit
- Commit only when the human asked (unless `.agents/config.json` → `commitPolicy` is `agent-may-commit`).
- `git status --short`: which files are yours? In a shared checkout other agents have unfinished work.
- Stage explicit paths: `git add path/a path/b`. Never `git add -A`, `git add .` or `git commit -a` (the hook blocks them in shared mode).
- `git diff --cached --stat` lists only your files.

## Message
- Conventional commits: `type(scope): subject` — feat, fix, docs, refactor, test, chore, ci, perf, build. Imperative, lower case, no period, ≤ 72 chars.
- Body: why, not what. Reference the bug id (`B-012`) or decision id if any.
- No `Co-Authored-By` trailers, no "Generated with" lines (the hook blocks them).

## Branches and worktrees
- One task per branch: `<type>/<short-name>`.
- Parallel writers use worktrees: `git worktree add ../<repo>-<task> -b <type>/<task> <base>`; clean up with `git worktree remove <path>` when merged.
- Rebase only a branch that was never pushed; otherwise merge the base branch in.

## Push and PR
- Never force-push or rewrite pushed history. Rejected push → stop and report.
- Pushes to protected branches (`.agents/config.json` → `protectedBranches`) may deploy and need the human's typed yes in this session.
- PR body: the Done report. Template: `.github/pull_request_template.md` if present.

## Conflicts
Resolve only files you own. For someone else's file, ask its owner through the message log. After resolving, re-run the tests.
