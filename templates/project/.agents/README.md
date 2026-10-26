# .agents — shared state for agents

| File | Owner | What |
|---|---|---|
| `config.json` | team | Work mode, protected files and branches, commands. Read by the hooks. |
| `PLAN.md` | manager | The plan the user approved: goal, tasks, agents. Worker agents ask the human until it says `Status: approved`. |
| `STATE.md` | state owner only | Current state of all work: done, in progress, waiting, next, decisions. |
| `HANDOFF.md` | whoever stops | Resume note for the next session or manager after a reset. |
| `BUGS.md` | bug-intake | Tester reports, triage, status, evidence. |
| `LOG.md` | everyone (append-only) | Agent messages: briefs, questions, claims, reviews. Not committed. |
| `tools/msg.js` | kit | `post`, `inbox`, `claims`, `thread`, `tail` for `LOG.md`. |

State sync: {{STATE_SYNC_RULE}}

Never put secrets, tokens, infra identifiers or personal data in these files.
