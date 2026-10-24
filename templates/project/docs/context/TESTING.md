# Testing standard

**Scope:** every new module, endpoint, job, consumer or cross-service flow is fully tested before it ships. Existing code has no test backlog, but any change to it must pass a smoke test of the old flow.

## Layers

| Layer | What | Real services? |
|---|---|---|
| Unit | Pure logic, services with dependencies mocked | No |
| Integration | Code with a real, disposable database or cache | Local only |
| End to end | The app through its public interface (HTTP, UI) | Local only, externals faked |
| Contract | Event and API payloads against fixed fixtures | No |
| Flow simulation | A script that seeds dummy data, walks a real journey, then cleans up (`--dry-run`, `--cleanup`) | Local or a shared dev env, never production |
| Regression smoke | The old flows a change touches | Local or dev |

Record the evidence (commands and result lines) in the Done report.

## Dummy data

- Prefix test records so they are easy to find and clean up (for example `TEST_` codes, `test+<n>@example.com` emails).
- Cleanup is idempotent. Never run simulations against production.
- External systems (payments, email, messaging, third-party APIs) are always faked in tests. Check that dev credentials do not point at real production accounts.

## Edge cases every feature covers

- Access: no permission, right permission, another tenant's or user's data (must fail).
- Validation: missing, empty, wrong type, oversized, unknown enum values.
- Idempotency: same request or event twice, out of order.
- External failure: timeout, 4xx, 5xx; fail-open paths still complete.
- State machines: every allowed and blocked transition, and a double submit.
- Soft-deleted rows, pagination limits, time zones and date boundaries, money rounding.

## Commands

```bash
{{TEST_CMD}}
```
