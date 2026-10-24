---
name: db-migration
description: Add database changes safely - additive, reviewed migrations (nullable or defaulted columns, new tables, online indexes), expand-then-contract for renames, idempotent backfills with dry-run, and an apply order that keeps the running app working. Use whenever a task needs a schema change, migration, backfill or data fix.
---

# Database migration

The schema file is usually protected: show the owner the exact diff first.

## Rules
- **Additive only:** new tables, new nullable or defaulted columns, new indexes. Never remove, rename or retype a column that running code uses.
- **Renames and type changes = expand and contract:** add the new column → write both → backfill → read the new one → (much later, separate release, owner's OK) stop writing the old one and retire it.
- **Large tables:** build indexes online/concurrently; backfill in batches; avoid long locks.
- **Never** run a reset, a push-style schema sync, or table-emptying commands against a shared database. The Bash hook blocks the common ones.
- Stored enums are strings in the DB; adding a value is additive, renaming is not.

## Steps
1. Write the schema change and generate the migration with the project's tool. Read the generated SQL line by line.
2. Check it on a disposable local database: apply, run the app and tests, then recreate it.
3. Backfill script: `--dry-run` (counts only) by default, `--apply` to write, batches, idempotent, logs counts, never touches production without the human's typed approval in this session.
4. **Apply order:** migration first, then the code that needs it. The old code must keep working on the new schema.
5. Record in the feature file: migration name, apply order, backfill command, rollback.

## Report
Migration file, SQL summary, local apply result, backfill dry-run counts, apply order and rollback.
