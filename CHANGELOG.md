# Changelog

## Unreleased

- Spawn budget: `limits` in `.agents/config.json`, a PreToolUse hook on the `Agent` tool that counts sub-agents, warns near a limit and asks the user when one would be crossed, a SubagentStop hook, and `budget.js plan|status|limits` for managers to check a plan before spawning. Verified end to end in Claude Code.
- New agents: `planner`, `test-writer`, `build-fixer`, `doc-updater`. New skills: `delegate` (small briefs, small reports, when not to spawn), `team-status`.
- Talking to the team: `msg.js roster`, an `instruction` message type (never an approval), and manager rules for relaying a user's instruction to any worker or stepping into a worker session.
- Agents for Codex and Cursor are generated from `agents/*.md` by `init` and `export-agents.js` (Codex and Cursor only; replaces the two hand-written Codex files).
- `npm run stats` (static footprint) and `scripts/session-stats.js` (real token numbers from a session transcript), `docs/BENCHMARK.md`.
- Windows, macOS and Linux: LF via `.gitattributes`, CRLF-tolerant parsers, Git Bash `/c/x` paths for `git -C`, real-path comparison, `git grep` in skills, a cross-platform test runner and a three-OS CI matrix.
- Community: code of conduct, issue and pull request templates, contributing guide.
- New `closer` agent and `closeout` skill: after the workers finish, split the feature into parts, hunt for missing or broken pieces, fix clear small gaps, ask the human only for real decisions, re-test, and send the manager a Closeout report (`msg.js` type `closeout`). The manager skill runs it before saying "done".
- Fix: protected-file and env-file checks missed edits when the tool passed a symlinked path (for example `/var` vs `/private/var` on macOS).
- `init` no longer adds a second copy of a doc the project already keeps elsewhere (matched by file name, any case). It links to the existing one and lists it under `existing`.
- `msg.js post` prints `posted: <header>` so it is not mistaken for a second copy of the message.

## 0.1.0

First release.

- Claude Code plugin with a marketplace in the same repo.
- 33 skills: setup and memory, multi-agent orchestration, everyday engineering, backend and data, frontend and apps, cloud and release, skill testing.
- 4 agents: reviewer, explorer, security-reviewer, qa-tester.
- Hooks: AI trailer block, secret scan, explicit staging, force push, protected branches, destructive DB commands, protected and env files, session-start notes (including after compaction).
- `init-project.js`: writes `AGENTS.md`, per-tool adapters (Claude, Codex, Cursor, Gemini, Copilot), `docs/context`, team rules, `.agents` state and the message tool.
- `export-skills.js`: copies skills for other agents.
- `git-guard.js`: tool-neutral commit checks.
- Tests (`node --test`) and behaviour evals (`claude plugin eval`).
- Quick start in the README and a step-by-step guide in `docs/INSTALL.md`.
