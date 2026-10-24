---
name: context-budget
description: Keep an agent's context small and tokens low - load only the docs a task needs, read file ranges not whole files, delegate wide searches to a subagent, filter long outputs, short replies, set up auto-compact and compact instructions, and write a hand-off before the context fills. Use in long sessions, for managers, when the context is getting full, or when asked to save tokens, set up auto compact or work leaner.
---

# Context budget

## Load less
- Start from `AGENTS.md` and open only the linked doc your task needs.
- Read the relevant part of a file (search first, then a line range), not the whole file.
- Wide searches across many files → the `explorer` agent; take its conclusion, not the file dumps.
- Long command output → filter it (`| tail -50`, `grep`, `--stat`) before it reaches you.
- Managers read only the end of worker transcripts and their Done reports.

## Keep less
- Do not paste large files or logs into messages; link the path.
- Summarise decisions into `.agents/STATE.md` (via the state owner) and feature docs, so they survive a reset.
- Close finished threads: rename finished sessions `Done: <name>`.

## Before it fills
When the context is about two-thirds full, or before switching to a different task:
1. Run the `handoff` skill (write mode).
2. Compact or start a fresh session; resume with the `handoff` skill (resume mode).

## Auto-compact setup (Claude Code)
- Auto-compact is on by default; keep it on (`/config` in a terminal session).
- Compact earlier than the default so the summary is made while there is room: the project's `.claude/settings.json` (written by `init`) sets `"env": { "CLAUDE_AUTOCOMPACT_PCT_OVERRIDE": "75" }`. It can only lower the threshold, and behaviour may vary by version, so check it with `/context` in a long session.
- `AGENTS.md` has a **Compact instructions** section: what a summary must keep (task, decisions, files, commands and results, approvals, next step) and what to drop. Every tool that reads `AGENTS.md` sees it.
- After a compaction the kit's SessionStart hook reminds the agent not to re-read what it already summarised and to re-open `.agents/HANDOFF.md` first.
- Manual: `/compact keep <what matters>` at a natural break (after a fix lands, before a new task) beats an automatic compaction mid-edit.

## Short replies
- No recap of what the reader saw. Lead with the result. Link paths instead of pasting.
- For a terse personal style, set the plugin option `reply_style` to `caveman-lite` (or use the `caveman` skill).

## Other agents
Codex, Cursor, Gemini and Copilot have their own compaction or summarisation; the `AGENTS.md` sections above are what they all read, so keep them there, not in a tool-specific file.

## Spend where it matters
Use a strong model for design, risky changes and reviews; a fast, cheaper model for well-specified edits, searches and checks.
