---
name: docs-sync
description: Keep project docs true after a change - find which docs a change affects, update them in the same task, mark replaced text Outdated, keep files small and the AGENTS.md index short. Use after finishing or partly finishing a task, after changing behaviour, rules, env vars, APIs or ownership, or when the user asks to update the docs or memory.
---

# Docs sync

Rule: if behaviour or a convention changed and the docs did not, the task is not done.

## 1. What changed?

`git diff --stat` (and staged). List: behaviour, APIs, data shape, env vars and flags, rules, ownership, debugging knowledge, open questions.

## 2. Where it goes

Use the table in `docs/context/README.md`. Defaults:

| Change | Doc |
|---|---|
| Feature behaviour, API, flags | `docs/context/features/<feature>.md` |
| New rule or convention | one line in `AGENTS.md` or `.claude/rules/*`, body in the matching `docs/context/*` file |
| Ownership, new area | `docs/context/MODULE_MAP.md` |
| Non-obvious debugging | `docs/context/DEBUGGING.md` |
| Env var | `.env.example` (safe default) + feature file |
| Progress | message to the state owner (not `STATE.md` directly) |

## 3. Edit

- Change the smallest part that is now wrong. Replaced behaviour: mark it **Outdated (<date>)** with a pointer to the new section, or remove it if nothing refers to it.
- One topic per file, about 150 lines. Split before it grows past that; link from the index instead of copying.
- Never add personal preferences, secrets, infra identifiers or customer data.
- Do not grow `AGENTS.md`; add a navigation row only for a new area.

## 4. Check

- Links you added resolve (`ls` the paths).
- No duplicate truth: `grep -rn "<key term>" docs AGENTS.md` shows one current statement.
- List the docs you updated in the Done report.
