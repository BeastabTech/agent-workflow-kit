# Self-review checklist (before saying "done")

Review your own diff as a strict reviewer would and fix what you find. Then report what you checked and what you could not check.

## Correctness and compatibility
- [ ] Every caller of a changed function, route, field, enum, event or env var still works.
- [ ] Changes are additive. With new flags off, old behaviour is identical.
- [ ] No unanswered blocking `@question` is left.

## Security
- [ ] Every new endpoint or action checks authentication and permission, or is public on purpose with the reason written down.
- [ ] Data is scoped to the caller (user, team or tenant). Guessing another id gives no access.
- [ ] Input is validated. No query or shell command is built from raw input.
- [ ] Nothing sensitive is logged or returned: tokens, passwords, keys, personal data the screen does not need.
- [ ] Webhooks and inbound events are authenticated.
- [ ] No secrets or infra identifiers in code, docs or commits.

## Concurrency and idempotency
- [ ] Double submits and parallel users cannot create duplicates or lose updates (unique constraint, conditional update, or transaction).
- [ ] State changes check the current state inside the same write.
- [ ] Jobs and consumers are safe to run twice and on two instances.

## Edge cases
- [ ] Empty, null, missing, oversized input; inactive or soft-deleted records; external timeouts and errors.
- [ ] Time zones, date boundaries, money rounding, pagination caps.

## Shape and docs
- [ ] Small files and functions, no new god file, no needless abstraction, shared code reused.
- [ ] API docs or types match the real shapes.
- [ ] New major functions have `@owner` / `@summary` headers.
- [ ] Docs updated (`README.md` table in this folder).
