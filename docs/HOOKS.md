# Hooks

All hooks are plain Node.js with no dependencies. They **fail open**: broken input or an internal error lets the action through. They block only clear cases and ask or warn otherwise.

| Hook | Event | Script |
|---|---|---|
| Bash guard | PreToolUse `Bash` | `scripts/hooks/pre-bash.js` |
| Edit guard | PreToolUse `Edit`, `Write`, `MultiEdit`, `NotebookEdit` | `scripts/hooks/pre-edit.js` |
| Spawn budget | PreToolUse `Agent` (also `Task`) | `scripts/hooks/pre-agent.js` |
| Spawn finished | SubagentStop | `scripts/hooks/subagent-stop.js` |
| Done gate | Stop | `scripts/hooks/stop.js` |
| Session note | SessionStart | `scripts/hooks/session-start.js` |
| Git guard (any tool) | git `pre-commit`, `commit-msg` | `scripts/git-guard.js` (copied to `.agents/tools/`) |

## Profiles

`minimal`, `standard` (default) and `strict` change which checks run and how hard they stop; see [CONFIG.md](CONFIG.md#hook-profiles).

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
| `plan-gate` | starting a worker sub-agent (not explorer, planner or reviewer) in a project with `.agents/config.json` | ask until `.agents/PLAN.md` says `Status: approved`; off in `minimal` and with `planGate: false` | yes |
| `machine-check` | starting a sub-agent | reads free memory, CPU load and running agent processes; asks when the spawn would run more agents at once than the machine can take, warns on the first agent under high pressure | no (defaults apply) |
| `agent-budget` | starting a sub-agent | warn from `warnAtPct` of a limit, a repeated or oversized brief; a warning when an `explorer` starts in a repo under `smallRepoFiles` tracked files; ask when `maxParallel`, `maxSpawns` or `tokenBudget` would be crossed | no (defaults apply) |

### Done gate

When the agent is about to stop after changing code, the Stop hook reads the transcript and checks what the agent actually did: did it run a test command after its last edit, did that run fail, and (in `best`) did it add or update any test file. If not, it blocks the stop with the specific reason, at most twice per session, so it cannot loop. Docs-only changes are ignored. It runs only in the `best` edition, which requires a passing test run and a test file; in the other editions it is off because in the benchmarks it added 20 to 90 percent more tokens on small tasks without changing the result. State in `.agents/.gate/`. Turn it off with `AWK_DISABLE=done-gate`; `minimal` profile turns it off too. The test command is recognised by name (jest, pytest, go test, npm test, ...) or from `commands.test` in `.agents/config.json`.

### Spawn budget

On every sub-agent start the hook checks, in order: the plan gate (worker agents need `Status: approved` in `.agents/PLAN.md`, read from the current checkout, then the main checkout), the machine (free memory, CPU load, running agent processes: one spawn over the safe count asks; under high pressure the first agent warns and a second asks), then the spawn budget. A spawn that ends in a question is not counted, so a declined spawn leaves no phantom running agent. Every start that goes through is counted per session in `.agents/.budget/<session>.json` (gitignored). SubagentStop marks one as finished so the parallel count stays right. The token figure is an **estimate** (an assumed size per agent plus brief length / 4) meant for early warning. If you decline a spawn the hook already counted it; the count can only be too high, never too low. Managers check a plan first with `node .agents/tools/budget.js plan --agents 6 --parallel 3` and `budget.js status` shows the session. Turn it off with `AWK_DISABLE=agent-budget`.

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
