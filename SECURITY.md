# Security

## Reporting
Please report security problems privately through GitHub's "Report a vulnerability" (Security tab) on this repository. Do not open a public issue for a vulnerability. We aim to reply within a week.

## Scope
- Hooks or the git guard letting a clear secret or a destructive command through.
- Hooks or scripts that could run unintended commands or leak file contents.
- Templates or skills that tell agents to do something unsafe by default.

## What the kit is not
The hooks are a safety net against mistakes, not a security boundary. A determined user or agent can turn them off (`AWK_HOOKS=off`, plugin options) or bypass git hooks. Keep real protections where they belong: branch protection, required reviews, least-privilege credentials, secret scanning in CI.
