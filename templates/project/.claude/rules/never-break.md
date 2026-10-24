# Never break what runs today

Users and other services depend on current behaviour. Every change keeps it.

## Before you change anything
- Find every caller of what you touch (`grep -rn` for the function, route, field, event, enum value or env var). For cross-service contracts, check the sibling repos too.
- Read the area's feature file in `docs/context/features/` (later sections override earlier ones).

## Hard rules
- **Additive only.** New columns are nullable or defaulted. No renaming, removing or retyping of columns, routes, response fields, events or enum values.
- **API contracts.** Never remove or rename a response field. New request fields are optional. Keep the existing response envelope.
- **Protected files:** show the owner (`docs/context/MODULE_MAP.md`) the exact diff and wait.
- **Side effects fail open** unless they are the point of the action; say so in code.
- **New flows behind a flag** that defaults to off.
- **Data isolation.** A new code path never widens what a user can see.
- **No destructive data commands** against shared databases.

## Before you say "done"
Run the `safe-change` and `self-review` skills (or `docs/context/SELF_REVIEW.md`). If something could not be run, say so plainly.
