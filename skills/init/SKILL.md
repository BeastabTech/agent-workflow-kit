---
name: init
description: Set up the agent workflow in a project - interview the owner, then write a short AGENTS.md index, per-tool adapters (Claude, Codex, Cursor, Gemini, Copilot), docs/context pack, team rules, .agents state files, the message tool and optional git hooks. Use when someone asks to set up, bootstrap or onboard this workflow, project memory or agent rules in a repo.
argument-hint: "[target folder]"
---

# Set up the workflow in a project

Target: `$ARGUMENTS` (default: the current repo root).

## 1. Look before you ask (read-only)

- `git status --short`, `git branch --show-current`, `git remote -v` (names only, never print tokens).
- Find the stack and commands: `package.json` scripts, `pyproject.toml`, `go.mod`, `Cargo.toml`, `Makefile`, CI files.
- Check for existing `AGENTS.md`, `CLAUDE.md`, `.claude/`, `docs/`, `.agents/`. The script never overwrites; note what exists so you can merge by hand later.
- Guess protected files: auth, permissions, DB schema, migrations, seeds, payment code, CI/deploy files.

## 2. Ask the essentials now (one message, numbered, each with your recommendation)

Ask only what the setup cannot guess and what is costly to get wrong. Prefill every answer from step 1 so the owner mostly confirms.

1. **Edition** (single choice; recommend `normal` unless they say otherwise):
   - `lite`: safety net only, least overhead; compact `AGENTS.md`, five core skills, git hooks, no plugin needed.
   - `low-tokens`: cheapest sessions; short replies, solo unless the problem is big, ten core skills, no plugin needed.
   - `auto`: the kit sizes each task itself and behaves like low-tokens, normal or best as needed (good if they do not want to choose).
   - `normal`: balanced default; full skills and hooks, solo for small work, self-review before done.
   - `best`: strictest, more tokens; strict hooks, a test run and a test file before done, independent review of risky code, closeout on multi-part work.
   Pass it as `"preset"` in the answers JSON (or `--preset <name>`). Details: `docs/EDITIONS.md`.
2. **Project** name, one-line summary, stack and source folders (prefilled; confirm).
3. **Commands**: install, type-check, build, test, lint, dev (prefilled; confirm or correct).
4. **Base branch and protected branches** (prefilled from git; pushes there may deploy).
5. **Which agents does the team use?** `claude`, `codex`, `cursor`, `gemini`, `copilot` (default: all; each adds one small pointer file to `AGENTS.md`). If any tool besides Claude Code is used, ask two more in the same message, recommending yes to both: export the skills to `.agents/skills/` for those tools, and turn on the tool-neutral git hooks (secret scan and AI-trailer block at commit time; without them those tools have no secret scan).
6. **State sync:** `git` (state files committed; teams and several machines), `local` (one machine, gitignored) or `folder` (a synced folder as `sharedDir`). This decides what goes into `.gitignore`.
7. **`.gitignore`**: show the lines the dry run reports under `gitignoreSuggest` (things that exist and git does not ignore: env files, dependency and build folders) and ask which to add; they go in the answers as `"gitignore": [...]`. If `trackedEnvFiles` is not empty, say so plainly: those files are already committed, ignoring them is not enough, they must be removed from git and their secrets rotated. That is the owner's decision; do not do it yourself.

Wait for answers. Do not write anything before.

### Ask later, when a task first needs it

Leave these out of the answers. `init` then keeps the default and lists the setting under `"unset"` in `.agents/config.json`; the session-start note names what is still open. When a task reaches the trigger, ask that one question, write the answer to `.agents/config.json` (and the doc named below), and remove it from `"unset"`. Never ask them all at once, and never ask one again once it is answered.

| Setting | Default until asked | Ask when |
|---|---|---|
| `protectedFiles` (globs that need the owner's OK) | none | first edit to auth, permissions, DB schema, migrations, payment or deploy files |
| `owners` (`area · paths · owner`; people or roles, never an agent) | whole repo, `<owner>` | a change needs an approval and nobody is named (`docs/context/MODULE_MAP.md`) |
| `workMode`: `shared` (one checkout; claims and explicit staging) or `worktree` (each writing agent in its own git worktree; recommend it for 2+ writers) | `shared` | a second agent is about to write code at the same time |
| `mergeFlow` (branches that run ahead and never come back into features; PR or direct; who approves) | nothing protected from back-merges | the first merge or release of a branch into another (`git-workflow` skill) |
| `commitPolicy`: `on-request` (agents commit only when asked; recommended) or `agent-may-commit` | `on-request` | the user asks an agent to commit on its own |
| `timezone` | `UTC` | the first user-facing time or schedule |
| Tool-neutral git hooks, when only Claude Code is used | off (the plugin's hooks already cover Claude Code) | the team adds another agent tool, or asks for a commit-time secret scan for humans too |
| Optional files (gitleaks config, husky, PR template) | not written | the owner asks for one |

## 3. Write

1. Save the answers as JSON in a temp file (shape: `${CLAUDE_PLUGIN_ROOT}/templates/answers.example.json`).
2. Dry run, show the list, then write:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/init-project.js" --target <dir> --answers <answers.json> --dry-run
   node "${CLAUDE_PLUGIN_ROOT}/scripts/init-project.js" --target <dir> --answers <answers.json> [--tools claude,codex,cursor,gemini,copilot] [--with-git-hooks] [--with-optional]
   node "${CLAUDE_PLUGIN_ROOT}/scripts/export-skills.js" --target <dir> --to agents     # only if the owner said yes to exporting skills
   ```
   With git hooks, tell the owner to turn them on themselves (it changes git config): `git config core.hooksPath .githooks`.
3. For every file reported as `kept` (already existed), show the owner the useful parts of the template and merge by hand only with their OK. An existing `CLAUDE.md` gets one line: `@AGENTS.md`. Files reported as `existing` were skipped because the project already has that doc under another path (for example `docs/core/architecture.md`). The generated links point there instead. Tell the owner which ones.
4. Fill `docs/context/ARCHITECTURE.md` from what you read in step 1 (short, no secrets, no infra ids).

## 4. Check and report

- `git grep -n --untracked "{{" -- AGENTS.md docs/context .claude/rules .agents` must find nothing.
- `node .agents/tools/msg.js where` prints the log path.
- `git status --short` must not list `.agents/.budget/`, `.agents/.gate/`, `.agents/.loops/`, `.agents/.read/` or `.claude/settings.local.json`. If it does, the `.gitignore` step failed: fix it before reporting.
- Report: files written, files kept, the `.gitignore` lines added, the settings still under `"unset"`, what the owner should review, and the next step: "start a manager session with the `manager` skill, or just work: the rules apply already."
- Do not commit unless asked. If asked: stage the written paths explicitly, `docs(agents): add agent workflow kit`.

## Without the plugin

Anyone can run the same scripts from a clone of the kit, with any agent: `node scripts/init-project.js --target ../my-repo --answers answers.json --with-git-hooks` and `node scripts/export-skills.js --target ../my-repo --to agents`.
