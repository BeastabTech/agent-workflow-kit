# Definition of Done (with evidence)

A task is done only when the agent can fill in this report truthfully. "Should work" is not evidence.

```markdown
## Done report: <task>
- Change: <one or two lines; files or areas touched>
- Verified:
  - `<command>` → <result line, e.g. "42 passed, 0 failed">
  - `<command>` → <result line>
  - Old flow smoke: <what you exercised> → <result>
- Not run, and why: <command or check> — <reason>  (write "none" if everything ran)
- Docs updated: <files>  (or "none needed: <why>")
- Open items: <@todo / @question left, follow-ups>  (or "none")
- Approvals used: <who approved what, in which session>  (or "none needed")
```

Rules:
- Paste the real result line from the command output. Never summarise a failure as a pass.
- If a required check could not run (missing service, no credentials), the task is "done except X", not "done".
- Reviewer and state owner accept the task only with this report.
