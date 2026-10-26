# Modes

Set in `.agents/config.json` (written by `init`). Change them any time; the hooks read the file on every call.

## Work mode: `shared` or `worktree`

| | `shared` | `worktree` |
|---|---|---|
| Checkout | All agents in one folder | Each writing agent in its own `git worktree` and branch |
| Before editing | Post a `claim` for the files | Optional claim (still useful for shared files such as schemas) |
| Staging | Explicit paths only; the hook blocks `git add -A`, `git add .` and `commit -a` | Broad staging only warns |
| Merging | Not needed | Each branch is reviewed and merged by a human or the manager |
| Best for | One writer plus read-only helpers; small repos | Two or more agents writing code at the same time |

The message log and state always resolve to the **main checkout's** `.agents/` folder (via `git rev-parse --git-common-dir`), so every worktree reads and writes the same log.

Create a worktree for a worker:

```bash
git worktree add ../my-repo-login -b feat/login
```

## Talking: `hub` or `peer`

- **hub**: workers send questions and results to the manager; the manager decides and forwards. Simple, slower, the manager's context grows.
- **peer**: workers message each other directly for contracts, reviews and hand-offs between them; they copy the manager (`--to manager`) on decisions, blockers and done. Faster for frontend/backend pairs.

Both use the same message types. See [COMMUNICATION.md](COMMUNICATION.md).

## Channel: tool-native or file log

- **Tool-native**: if your agent tool can message other sessions, use it for speed.
- **File log** `.agents/LOG.md` via `node .agents/tools/msg.js`: works for every tool, across tools (a Codex worker and a Claude manager), and across machines when `stateSync` is `folder` or `git`.
- When both exist, post decisions, claims and done reports to the file log too, so there is one record.

## State sync: `git`, `folder` or `local`

| Value | Where state lives | Sync |
|---|---|---|
| `git` | `.agents/STATE.md`, `HANDOFF.md`, `BUGS.md`, `PLAN.md` committed; `LOG.md` gitignored | `git pull` |
| `folder` | `sharedDir` (for example a synced drive folder) | the folder sync |
| `local` | `.agents/` gitignored | none; copy the hand-off by hand |

`AWK_SHARED_DIR=/path` overrides the folder for one shell.
