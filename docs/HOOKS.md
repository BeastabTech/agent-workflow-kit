# Hooks

All hooks are plain Node.js with no dependencies. They **fail open**: broken input or an internal error lets the action through. They block only clear cases and ask or warn otherwise.

| Hook | Event | Script |
|---|---|---|
| Bash guard | PreToolUse `Bash` | `scripts/hooks/pre-bash.js` |
| Edit guard | PreToolUse `Edit`, `Write`, `MultiEdit`, `NotebookEdit` | `scripts/hooks/pre-edit.js` |
| Spawn budget | PreToolUse `Agent` (also `Task`) | `scripts/hooks/pre-agent.js` |
| Spawn finished | SubagentStop | `scripts/hooks/subagent-stop.js` |
| Session note | SessionStart | `scripts/hooks/session-start.js` |
| Git guard (any tool) | git `pre-commit`, `commit-msg` | `scripts/git-guard.js` (copied to `.agents/tools/`) |

## Checks

| Check | Trigger | Decision | Needs team config |
|---|---|---|---|
| `ai-trailers` | `git commit` message (inline or `-F file`) with Co-Authored-By, "Generated with" or a robot emoji | deny | no |
| `secret-scan` | `git commit`: staged diff, files added in the same command, `-a`; env files | deny for clear keys and env files, ask for generic `password = "..."` | no |
| `secret-scan` | Write/Edit content with a clear key | deny | no |
| `explicit-staging` | `git add -A`, `git add .`, `git add --all`, `git commit -a` | deny (shared) / warn (worktree) | yes |
| `force-push` | `git push` with a force flag or a `+refspec` | deny; with lease: ask | no |
| `protected-branch` | push to, or commit on, a branch in `protectedBranches` | ask | yes |
| `destructive-db` | `prisma migrate reset`, `prisma db push`, `db:reset/push/drop` scripts, `DROP TABLE/DATABASE/SCHEMA`, `TRUNCATE`, `DELETE FROM x` without `WHERE`, `rails db:drop`, django `flush`, `dropDatabase()`, `FLUSHALL`, `dropdb`, ORM schema drop, `knex migrate:rollback --all`, `terraform destroy` | deny (or ask with `"destructiveDb": "ask"`) | no |
| `protected-files` | edit of a path matching `protectedFiles` | ask | yes |
| `env-files` | edit of `.env`, `.env.local` and similar (not `.env.example`) | ask | no |
| `agent-budget` | starting a sub-agent | warn from `warnAtPct` of a limit, a repeated or oversized brief; ask when `maxParallel`, `maxSpawns` or `tokenBudget` would be crossed | no (defaults apply) |

### Spawn budget

Every start of a sub-agent is counted per session in `.agents/.budget/<session>.json` (gitignored). SubagentStop marks one as finished so the parallel count stays right. The token figure is an **estimate** (an assumed size per agent plus brief length / 4) meant for early warning. If you decline a spawn the hook already counted it; the count can only be too high, never too low. Managers check a plan first with `node .agents/tools/budget.js plan --agents 6 --parallel 3` and `budget.js status` shows the session. Turn it off with `AWK_DISABLE=agent-budget`.

Commands that only read (`grep`, `rg`, `git log`, `git show`, `git diff`, `man`) are skipped by the destructive-DB check.

## Secret patterns that block

AWS access key ids, private key blocks, GitHub tokens, Slack tokens, Google API keys, Stripe live keys, Anthropic and OpenAI API keys, GCP service-account key JSON, npm tokens. Values with words like `example`, `placeholder`, `changeme`, `<...>` or `${...}` are not flagged by the generic rule.

False positive? Add `awk-allow-secret` in a comment on that line, or add the path to `secretScan.allowPaths`.

## Turning things off

- Everything: `AWK_HOOKS=off`, or the plugin option `hooks_enabled = false`.
- One check: `AWK_DISABLE=destructive-db` (comma-separated list).
- Personal: plugin options `block_ai_trailers`, `secret_scan`, `destructive_db_guard`.
- Team: `"destructiveDb": "ask" | "off"`, `"staging": "any"` in `.agents/config.json`.

## Git guard for every tool

`init --with-git-hooks` writes `.githooks/pre-commit` and `.githooks/commit-msg`, which call `node .agents/tools/git-guard.js`. Turn them on per clone with `git config core.hooksPath .githooks`. If the project already uses husky or lefthook, call the same two commands from there instead.

## Testing hooks

```bash
node --test tests/*.test.js
echo '{"tool_input":{"command":"git push origin +main"},"cwd":"'"$PWD"'"}' | node scripts/hooks/pre-bash.js
```
