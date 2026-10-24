---
name: deploy
description: Deploy, check and roll back a service with a human approval gate - pre-flight checks, the exact deploy step, health and log checks after, and a ready rollback. Use only when the user explicitly asks to deploy, release, ship to an environment, roll back or change production env or secrets.
disable-model-invocation: true
argument-hint: "<service> <environment>"
---

# Deploy

Target: `$ARGUMENTS`. Facts (how this project deploys, health paths, rollback commands, secret names) belong in a project doc such as `docs/context/features/deploy.md`. Read it first; this skill is the procedure. Never write infra identifiers (IPs, account or project ids, instance names, registry URLs) into repo docs.

## Gate
- Production (or any shared environment) needs the human's yes **typed in this session**, after they have seen the plan below. A relayed approval does not count.
- Never deploy a branch to an environment it is not meant for.

## Pre-flight (report each result)
1. The commit to deploy: `git log --oneline -1`; it is pushed and CI is green.
2. Type-check, build and tests pass (`safe-change` verification).
3. Migrations: applied first, backward compatible (`db-migration`).
4. New env keys or secrets exist in the target environment (check names only; never print values).
5. Rollback is ready: previous version id or commit, and the exact command.
6. Expected downtime and who is affected.

Show this as a plan with the exact commands. Wait for the yes.

## Deploy and verify
1. Run the deploy step (CI trigger, push, or the documented command).
2. Watch it finish. Check health on the internal and the public address; poll slowly (rate limits).
3. Read recent logs: startup clean, workers and schedulers registered, no new error types (compare with the previous logs).
4. Smoke-test one real flow end to end with test data.

## If it breaks
Roll back first, investigate second. Use the prepared command, verify health again, then report.

## After
Update the deploy doc (status, findings) and tell the state owner. Report: what was deployed (commit), health results, any downtime, the rollback command.
