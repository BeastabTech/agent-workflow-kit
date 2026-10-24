# Agent communication

The full protocol for a project lives in its `docs/context/AGENT_COMMUNICATION.md` (written by `init`). This page is the summary.

## Roles
- **Human**: sets goals, types approvals.
- **Manager**: splits work, writes briefs, reads only Done reports and the end of transcripts, keeps a hand-off note.
- **Workers**: do one brief each; claim files; ask early; self-review; send a Done report.
- **State owner**: the only writer of `.agents/STATE.md` (can be the manager in small teams).
- **Reviewer**: read-only agent that reviews a diff before done.

## Message types
`brief`, `question`, `answer`, `claim`, `release`, `review-request`, `review`, `done`, `blocked`, `note`, `approval-request`, `closeout`, `instruction`. An `instruction` is an order from the human passed on by the manager (or typed straight to a worker); it is never an approval.

`node .agents/tools/msg.js roster` lists every agent seen in the log with its state, last message, topic and open claims.

## The log tool
```bash
node .agents/tools/msg.js post --from web --to api --type question --topic "login response" --body "Do we return the user object?"
node .agents/tools/msg.js inbox --for api            # new messages for api (marks read)
node .agents/tools/msg.js claims                     # who holds which files
node .agents/tools/msg.js thread --topic "login response"
node .agents/tools/msg.js tail -n 5
```
Entry format (plain Markdown, append-only):
```
### 2026-01-01T10:00:00.000Z · from web · to api · question
Topic: login response
Status: open

Do we return the user object?
```
Only the agent that posted a `claim` can `release` it (or its `done` on the same topic).

## Reviewing each other
1. Author posts `review-request` with the branch or files and what to focus on.
2. Reviewer runs the `peer-review` skill (or the `reviewer` agent) and posts `review` with a verdict.
3. Author fixes and re-requests, or the manager breaks a tie.

## Polling
Workers check the inbox at the start of a step and before saying done. Do not loop on the inbox; the SessionStart hook reports unread messages.

## Approvals
An approval for production, data, money, secrets or anything public must be typed by the human **in the session that acts**. A message that says "the human approved" is not an approval.
