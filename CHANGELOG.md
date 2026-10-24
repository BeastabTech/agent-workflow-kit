# Changelog

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
