# Worked example: a small to-do API

This walks through one bug in a small Express + SQLite to-do API with three agents: a **manager**, an **api** worker and a **qa** tester. All names are invented.

## 1. Set up (once)

In Claude Code, inside the repo, ask "set up the agent workflow here". Without the plugin, run:

```bash
node <kit>/scripts/init-project.js --target . --answers <kit>/examples/todo-api/answers.json --with-git-hooks --dry-run
node <kit>/scripts/init-project.js --target . --answers <kit>/examples/todo-api/answers.json --with-git-hooks
node <kit>/scripts/export-skills.js --target . --to agents   # only if someone uses Codex, Cursor, Gemini or Copilot
git config core.hooksPath .githooks
```

Result (abridged):

```
AGENTS.md  CLAUDE.md  GEMINI.md
.claude/rules/{never-break,working-agreement,git-and-approvals,code-comments}.md
.claude/settings.json
.cursor/rules/agent-workflow.mdc   .github/copilot-instructions.md   .codex/agents/{explorer,reviewer}.toml
docs/context/{README,ARCHITECTURE,MODULE_MAP,CONVENTIONS,TESTING,SELF_REVIEW,DEFINITION_OF_DONE,AGENT_COMMUNICATION,DEBUGGING}.md
.agents/{config.json,STATE.md,HANDOFF.md,BUGS.md,README.md}
.agents/tools/{msg.js,git-guard.js,lib/secrets.js}
.githooks/{pre-commit,commit-msg}
```

`src/db/schema.sql` and `src/auth/**` are protected (from `answers.json`), so editing them asks first.

## 2. The bug comes in

The QA agent (`qa-tester`) tests `POST /todos` and files a bug in `.agents/BUGS.md`:

```markdown
| B-001 | Empty title creates a to-do | qa | S3 | new | - | curl output below |

## B-001 Empty title creates a to-do
- Reported: 2026-01-10 by qa in local dev
- Steps: POST /todos {"title": ""}
- Expected: 400 with "title is required"
- Actual: 201, a to-do with an empty title
```

It tells the manager:

```bash
node .agents/tools/msg.js post --from qa --to manager --type note --topic "B-001" --body "Filed B-001 (S3): empty title accepted on POST /todos."
```

## 3. Intake and brief

The manager runs `bug-intake`, confirms severity S3, and briefs the api worker using `skills/manager/templates/brief.md`:

```text
Task: fix B-001 (empty title accepted on POST /todos).
Scope: src/routes/todos.js and its validation; no schema change.
Done when: a regression test fails before and passes after; the old create flow still works; Done report posted.
```

## 4. The worker fixes it

```bash
node .agents/tools/msg.js post --from api --to all --type claim --topic "B-001" --files "src/routes/todos.js,test/todos.test.js" --body "Fixing B-001"
```

The worker follows `tdd`. It writes `test/todos.test.js › rejects an empty title`, runs it and sees it fail, then adds the smallest validation that makes it pass. `safe-change` confirms that the response shape and status codes for valid input are unchanged.

## 5. Review and done

The worker asks the `reviewer` agent, which replies "approve with nits: trim whitespace too". The worker adds a test for `"   "`, fixes it, then sends the Done report (`skills/self-review/templates/done-report.md`):

```markdown
## Done report: B-001 empty title
- Change: validate title (trimmed, 1–200 chars) in src/routes/todos.js
- Verified:
  - `npm test` → 18 passed, 0 failed (2 new)
  - Old flow smoke: POST /todos {"title":"milk"} → 201, same body as before
- Not run, and why: none
- Docs updated: docs/context/features/todos.md (validation rules)
- Open items: none
- Approvals used: none needed
```

```bash
node .agents/tools/msg.js post --from api --to manager --type done --topic "B-001" --body "See Done report above."
```

The `done` message also releases the worker's claim.

## 6. State and hand-off

The state owner moves B-001 to `fixed (awaiting verify)` in `BUGS.md` and adds a line to `STATE.md` under **Done**. QA re-tests and marks it `verified`.

The manager's context is getting long, so it runs `handoff` (write mode). When the next session starts, the SessionStart hook says a hand-off exists, and `handoff` (resume mode) picks up from the next step.

## 7. What the guards did along the way

- The worker tried `git add -A` in shared mode and was told to stage explicit paths.
- A commit message containing a "Generated with" line was blocked.
- Committing a test fixture with a fake key needed `awk-allow-secret` on that line.
