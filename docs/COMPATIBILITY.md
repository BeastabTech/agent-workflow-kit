# Using the kit with different agents

The kit has three layers. Only the last is Claude-specific.

1. **Files every agent reads**: `AGENTS.md`, `.claude/rules/*.md` (plain Markdown despite the folder name), `docs/context/*`, `.agents/*`.
2. **Tool-neutral tools**: `.agents/tools/msg.js` (messages and claims), `.agents/tools/git-guard.js` + `.githooks/` (secret scan and trailer block at commit time), exported skills in `.agents/skills/`.
3. **Claude Code plugin**: skills with namespacing, agents, PreToolUse and SessionStart hooks, plugin options.

## Per tool

| Tool | Instructions | Skills | Guards |
|---|---|---|---|
| Claude Code | `CLAUDE.md` imports `AGENTS.md`; `.claude/rules/` auto-loaded | plugin | plugin hooks (+ git hooks) |
| Codex | `AGENTS.md` (native) | `export-skills --to codex` or `agents` | git hooks |
| Cursor | `AGENTS.md` + `.cursor/rules/agent-workflow.mdc` | `export-skills --to cursor` or `agents` | git hooks |
| Gemini CLI | `GEMINI.md` imports `AGENTS.md` | `export-skills --to gemini` or `agents` | git hooks |
| GitHub Copilot | `AGENTS.md` + `.github/copilot-instructions.md` | `export-skills --to agents` | git hooks |
| Others | `AGENTS.md` | point the tool at `.agents/skills/` | git hooks |

Where each tool looks for skills changes between versions. If your tool does not pick up a skill, tell it in its rules file: "procedures live in `.agents/skills/<name>/SKILL.md`; read the matching one before that kind of task" (the Cursor and Copilot adapters already say this).

## Mixed teams

A Claude manager can brief a Codex worker and a Cursor worker. They share the same `AGENTS.md`, the same claims and messages in `.agents/LOG.md`, and the same commit-time guards. Approvals still have to be typed by a human in the session that acts.
