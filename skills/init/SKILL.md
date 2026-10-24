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

## 2. Interview (one message, numbered, each with your recommendation)

1. Project name and one-line summary.
2. Stack and source folders.
3. Commands: install, type-check, build, test, lint, dev (prefill from step 1).
4. Base branch and protected branches (pushes there may deploy).
5. Protected files (globs) and owners per area (`area | paths | owner`). Owners are people or roles, never an agent.
6. **Work mode:** `shared` (all agents in one checkout; claims + explicit staging) or `worktree` (each writing agent in its own git worktree). Recommend `worktree` when 2+ agents write code at once.
7. **State sync:** `git` (state files committed, synced by pull; recommended for teams and several machines), `folder` (a synced folder path as `sharedDir`), or `local` (one machine, gitignored).
8. Commit policy: `on-request` (agents commit only when asked; recommended) or `agent-may-commit`.
9. Time zone for user-facing times.
10. **Which agents does the team use?** `claude`, `codex`, `cursor`, `gemini`, `copilot` (default: all; each adds one small pointer file to `AGENTS.md`). Export the skills for non-Claude tools too? (`.agents/skills/`, recommended if anyone uses another tool.)
11. **Tool-neutral git hooks?** Secret scan and AI-trailer block for every agent and human, not only Claude Code. Recommend yes for teams with several tools.
12. Add optional files? gitleaks config, husky hooks, PR template.

Wait for answers. Do not write anything before.

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

- `grep -rn "{{" AGENTS.md docs/context .claude/rules .agents` must find nothing.
- `node .agents/tools/msg.js where` prints the log path.
- Report: files written, files kept, what the owner should review, and the next step: "start a manager session with the `manager` skill, or just work: the rules apply already."
- Do not commit unless asked. If asked: stage the written paths explicitly, `docs(agents): add agent workflow kit`.

## Without the plugin

Anyone can run the same scripts from a clone of the kit, with any agent: `node scripts/init-project.js --target ../my-repo --answers answers.json --with-git-hooks` and `node scripts/export-skills.js --target ../my-repo --to agents`.
