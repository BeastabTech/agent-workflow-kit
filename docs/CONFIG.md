# Configuration

## Team settings: `.agents/config.json`

| Key | Default | Meaning |
|---|---|---|
| `workMode` | `shared` | `shared` or `worktree` (see [MODES.md](MODES.md)) |
| `stateSync` | `git` | `git`, `folder` or `local` |
| `sharedDir` | `null` | Folder for state and messages when `stateSync` is `folder` |
| `baseBranch` | `main` | Branch work is based on |
| `protectedBranches` | `main, master, production, prod, release` | Push or commit there asks first |
| `protectedFiles` | `[]` | Globs (`src/auth/**`, `db/schema.sql`) that ask before edit |
| `commitPolicy` | `on-request` | `on-request` or `agent-may-commit` (used by the rules text) |
| `staging` | `explicit` | Set to anything else to skip the staging check |
| `destructiveDb` | `deny` | `deny`, `ask` or `off` |
| `secretScan.allowPaths` | `[]` | Globs skipped by the secret scan (test fixtures) |
| `commands` | | install, typecheck, build, test, lint, dev commands |
| `limits.maxParallel` | `4` | Sub-agents running at once; one more asks you |
| `limits.maxSpawns` | `10` | Sub-agents started per session; one more asks you |
| `limits.warnAtPct` | `70` | Warn from this share of a limit |
| `limits.assumedAgentTokens` | `30000` | Rough tokens one sub-agent run costs (for the estimate) |
| `limits.tokenBudget` | `0` | Estimated tokens for all sub-agents; `0` means no limit |
| `limits.maxPromptChars` | `6000` | Brief size that triggers a "point to files instead" warning |
| `limits.maxFixRounds` | `2` | Fix rounds for the closer and reviewers (rule text only) |
| `tools` | all | Which agent adapters `init` wrote |

Without `.agents/config.json`, only the personal checks run (trailers, secrets, force push, destructive DB). Staging and protected-branch checks need the team file.

## Personal settings: plugin options

Set when enabling the plugin (stored in your own Claude Code settings, not the repo):

| Option | Default | Effect |
|---|---|---|
| `hooks_enabled` | `true` | All hooks on or off |
| `block_ai_trailers` | `true` | Block Co-Authored-By / "Generated with" in commits |
| `secret_scan` | `true` | Secret scan on commit and write |
| `destructive_db_guard` | `true` | Destructive DB command guard |
| `reply_style` | `normal` | `normal`, `caveman-lite`, `caveman-full` |

## Environment variables

| Variable | Effect |
|---|---|
| `AWK_HOOKS=off` | Turn every kit hook and the git guard off for this shell |
| `AWK_DISABLE=a,b` | Turn off named checks: `ai-trailers`, `secret-scan`, `explicit-staging`, `force-push`, `protected-branch`, `destructive-db`, `protected-files`, `env-files`, `agent-budget` |
| `AWK_SHARED_DIR=/path` | Message log and state folder override |

## Token and compaction settings

`init` writes `.claude/settings.json` with `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=75` (compact a bit earlier than the default). It can only lower the threshold and its behaviour may vary by version. `AGENTS.md` carries the "Save tokens" and "Compact instructions" sections that every tool reads.
