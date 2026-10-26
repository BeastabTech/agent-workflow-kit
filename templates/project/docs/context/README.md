# Context pack: cold start

Short, current facts for any agent or new developer. Read in this order and stop when you have enough.

## Session-start checklist

1. Read `AGENTS.md`.
2. Read `.agents/HANDOFF.md` if it has content, then `.agents/PLAN.md` (the agreed plan, if any), then `.agents/STATE.md`.
3. Run `git status --short`. Other agents may have unfinished work in this checkout ({{WORK_MODE}} mode).
4. Check messages: `node .agents/tools/msg.js inbox --for <your-name>`.
5. Open only the deep doc your task needs (table in `AGENTS.md`).
6. Finish: update the docs your change touched (table below), write the Done report, and commit only if asked.

## What to update when you…

| Change | Update |
|---|---|
| shipped or changed a feature | its file in `features/`; `.agents/STATE.md` (via the state owner) |
| added or changed a shared helper | a doc comment on it and a line in `ARCHITECTURE.md` → Shared helpers |
| debugged something non-obvious | `DEBUGGING.md`: symptom → cause → how to check (exact commands) |
| added a rule or convention | one or two lines in `AGENTS.md` or `.claude/rules/*`, body in the matching doc |
| changed ownership or added an area | `MODULE_MAP.md` |
| added an env var or flag | `.env.example` with a safe default, plus the feature file |
| fixed a reported bug | its row in `.agents/BUGS.md` with the evidence |
| stopped mid-task or handed over | `.agents/HANDOFF.md` |

If you changed behaviour or a convention and did not update the docs, the task is not done.
