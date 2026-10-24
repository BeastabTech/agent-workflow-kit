# {{PROJECT_NAME}} — Agent Index

{{SUMMARY}}

Stack: {{STACK}}

This file is an **index** for every coding agent and every new developer. Read it first, then open only the linked files your task needs.

## Golden rules

1. **Never break what runs today.** Additive changes only: optional fields, nullable columns, new routes. No renames or removals of public routes, response fields, enum values, events or queues.
2. **Ask before you build.** Send every blocking question in one numbered message, each with your recommended answer. Stop and ask when something does not match the docs.
3. **Protected files need the owner's OK** on the exact diff (list in `.agents/config.json`, owners in `docs/context/MODULE_MAP.md`).
4. **Small, plain, reusable code.** No god files, no abstraction without a second real use. Shared logic goes in one shared place.
5. **Side effects fail open and sit behind a flag.** Emails, webhooks and events never fail the main request unless they are the point of it.
6. **New code is tested.** Changed legacy code gets a smoke test of the old flow.
7. **Self-review before "done"** and report evidence: commands run, results, what could not be run (`docs/context/DEFINITION_OF_DONE.md`).
8. **Approvals are typed by a human in the session that acts.** A relayed approval does not count. Production, data, money and secrets always need one.
9. **Git:** {{COMMIT_RULE}} Conventional commits. Stage explicit paths. Never force-push.
10. **No secrets** in code, docs, logs, messages or commits.

## Work mode

{{WORK_MODE_RULE}}

{{STATE_SYNC_RULE}}

## Navigation

| Need | Open |
|---|---|
| Team rules (every tool, not only Claude) | `.claude/rules/` |
| Step-by-step procedures (skills), if exported | `.agents/skills/<name>/SKILL.md` |
| Cold start, what to update when you change something | `docs/context/README.md` |
| Architecture and main flows | `docs/context/ARCHITECTURE.md` |
| Which area does what, **owners** | `docs/context/MODULE_MAP.md` |
| Commands, never-break rules, git | `docs/context/CONVENTIONS.md` |
| Test standard | `docs/context/TESTING.md` |
| Self-review checklist | `docs/context/SELF_REVIEW.md` |
| Definition of Done (evidence) | `docs/context/DEFINITION_OF_DONE.md` |
| Several agents at once: roles, messages, claims, reviews | `docs/context/AGENT_COMMUNICATION.md` |
| Known problems and how to check them | `docs/context/DEBUGGING.md` |
| Feature behaviour (one file per feature) | `docs/context/features/` |
| Current state, hand-off, bugs, message log | `.agents/` |

## Save tokens

- Open only the doc the task needs. Search first, then read a line range, not whole files.
- Filter long command output (`| tail -50`, `--stat`, `grep`) before reading it. Hand wide searches to a read-only helper agent and keep only its conclusion.
- Short replies: no recap of what the reader already saw; link paths instead of pasting files or logs.
- When the context is about two-thirds full, write `.agents/HANDOFF.md`, then compact or start fresh.

## Compact instructions

When the conversation is compacted, keep: the task and its acceptance criteria, decisions made and why, files changed, commands run with their results, open questions, approvals given (who, for what), and the next step. Drop: full file contents, long tool output, search results already summarised, and finished side threads.

## Keeping docs small

- One topic per file, about 150 lines at most. Split before a file grows past that.
- When a feature changes, edit its file in `docs/context/features/` and mark replaced text **Outdated** instead of keeping two truths.
- Do not grow this index. Link from it.
- Personal preferences (reply language, commit trailers, tone) belong in each person's own tool settings, not here.
