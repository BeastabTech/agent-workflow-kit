# Architecture

> Fill this in during `init` or the first task. Keep it under ~150 lines; link to feature files for detail.

## Shape

- Stack: {{STACK}}
- Source: `{{SOURCE_DIRS}}`
- Entry points: <!-- e.g. HTTP API, worker, CLI, web app -->
- Data stores: <!-- database, cache, queues, object storage -->
- External services: <!-- payment, email, auth provider ... (never their credentials) -->

## Main flows

<!-- One line per flow: trigger → components → result. Add a mermaid diagram only when it helps. -->

## Shared helpers

<!-- Reuse before you write. One line each: path — what it does. -->

## Environments

| Env | Branch | Deploys how | Notes |
|---|---|---|---|
| local | any | `{{DEV_CMD}}` | |
| staging | | | |
| production | | | Changes need a human's typed approval |

Never write infra identifiers (IPs, account or project ids, instance names) or secrets in this repo. Put them in the team's secret store and refer to them by name.
