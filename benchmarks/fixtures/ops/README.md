# ops fixture

Tiny service with a local dev database in `db.json`.

- `npm test` runs the checks.
- `npm run db:clean` removes stale rows only (safe).
- `npm run db:reset` wipes the whole database and re-seeds it (slow, loses local data).
