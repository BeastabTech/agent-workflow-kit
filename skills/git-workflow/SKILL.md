---
name: git-workflow
description: Team-safe git - branches or worktrees per task, explicit staging, conventional commits without AI attribution, no force-push, protected branches, clean hand-offs in a shared checkout, merging a feature into a branch that runs ahead. Use when committing, branching, creating worktrees, pushing, opening a PR, merging or releasing a branch into another, or resolving a conflict.
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
- Rebase only a branch that was never pushed. To update a pushed feature branch, merge in only the branch it was cut from (usually production). Never merge, pull or rebase a branch that runs ahead (`mergeFlow.noBackMerge`, for example `dev`) into it: the feature would then carry every unreleased change on that branch and could never ship alone. The hook asks before such a command.

## Push and PR
- Never force-push or rewrite pushed history. Rejected push → stop and report.
- Pushes to protected branches (`.agents/config.json` → `protectedBranches`) may deploy and need the human's typed yes in this session.
- PR body: the Done report. Template: `.github/pull_request_template.md` if present.

## Merge a feature into another branch (release to dev, staging, a release branch)

Typical case: the feature was cut from production, several people and agents worked on it in sub-branches, and it must now go into `dev`, which is far ahead and holds other unreleased features. The feature branch stays clean; every conflict is resolved on the target's side.

**0. The team's way, asked once and remembered.** If `mergeFlow` is listed under `"unset"` in `.agents/config.json`, ask the user before the first merge, in one message with your recommendation: which branches run ahead and must never come back into feature branches; merge by PR or directly; who approves a merge into each. Write the answers to `mergeFlow` (`noBackMerge`, `integrationPrefix`, and the user's other decisions as short lines in `notes`), remove `mergeFlow` from `"unset"`, and follow it from then on without asking again. A new kind of decision later (how to order migrations, which side wins for a shared config) goes into `notes` the same way.

**1. Measure before touching anything** (read-only):
```bash
git fetch origin
git log --oneline origin/<target>..origin/<feature> | wc -l          # commits going in
git diff --stat origin/<target>...origin/<feature> | tail -1         # size of the feature
git merge-tree --write-tree --name-only origin/<target> origin/<feature>   # conflicted files, nothing changed on disk
```
Tell the user: commits, files, and the conflicted files grouped as "I can resolve" and "needs your decision" (rules below). Zero conflicts: say so and go on.

**2. Resolve on a branch cut from the target**, in its own worktree so nobody's checkout moves:
```bash
git worktree add ../<repo>-integrate -b integrate/<feature>-into-<target> origin/<target>
cd ../<repo>-integrate && git merge --no-ff origin/<feature>
```
The feature branch is only read. Sub-branches not yet merged into the feature: merge them into the feature first, by their owners, not here.

**3. Resolve each conflict by what both sides meant**, reading both commits (`git log -p --merge -- <file>`):

| Resolve yourself | Ask the user (one message, numbered, each with your recommendation) |
|---|---|
| Both sides added different things in the same place (imports, routes, exports, list entries, tests): keep both | Both sides changed the same behaviour in different ways: one must lose |
| One side renamed or moved, the other edited: apply the edit at the new place | One side deleted what the other changed |
| Lock files and generated files: take the target's, then regenerate with the package manager or generator | Database migrations and schema: order, renumbering, anything touching existing data |
| Formatting or whitespace only | Protected files, auth, payments, env and deploy config |
| | A conflict in code whose owner is someone else and whose intent you cannot tell from the commits |

Never take one side for the whole merge (`-X ours`, `-X theirs`, `checkout --ours .`), never drop a target-side change to make a test pass, never leave a conflict marker. If the feature needs a change to fit the target (an API the target renamed), make that change here in the merge, not on the feature branch.

**4. Prove it:** `git grep -nE '^(<<<<<<<|=======|>>>>>>>)( |$)'` finds nothing; install, type-check, build and the full tests pass on the integration branch; `git diff origin/<target>...HEAD --stat` shows the feature's files and nothing unexplained.

**5. Deliver the way `mergeFlow` says** (default: PR from the integration branch into the target; a protected target needs the user's yes typed here). PR body: commits merged, each conflict and how it was resolved, the user's decisions, test evidence. After the merge, remove the worktree and the integration branch.

## Conflicts while you work
In day-to-day work resolve only files you own. For someone else's file, ask its owner through the message log. After resolving, re-run the tests. Merging a whole branch into another follows the section above.
