---
name: security-audit
description: Security review of a change or an area - authentication, authorisation and data scoping, input handling and injection, secrets, sensitive data in logs and responses, webhooks, uploads, dependencies, rate limits. Use when code handles auth, user input, files, payments, secrets or external callbacks, before a release, or when asked for a security check.
---

# Security audit

Read-only first. For a large scope start the `security-reviewer` agent and merge its findings.

## Checklist

**Access**
- Every entry point checks authentication and permission (or is public on purpose, with the reason written down).
- Records are scoped to the caller (user, team, tenant). Change an id in the request → no access (403/404, not someone else's data).
- Admin and bypass paths are explicit, logged and tested.

**Input**
- Validated at the boundary (type, length, range, enum).
- No SQL, shell, template or path built from raw input; parameterised queries only.
- Output encoding for HTML; no raw-HTML rendering of user data.
- SSRF: outbound URLs from user input use an allowlist.

**Secrets and sensitive data**
- No keys, tokens or passwords in code, docs, tests, logs or commits (search history on suspicious strings when in doubt).
- Responses and logs carry only what the screen needs; no tokens, OTPs or full documents.
- Secrets come from env or a secret manager and are never printed.

**Edges**
- Webhooks verify signature or shared secret, reject replays.
- Uploads: size and type limits, private storage, short-lived signed URLs, key checked before saving.
- Rate limits on login, OTP, search and expensive endpoints.
- Dependencies: `npm audit` / `pip-audit` / `govulncheck` etc.; note high or critical findings.

## Report
`severity · file:line · issue · exploit in one sentence · fix`. Critical and high first. Never include working exploit payloads against real systems, real tokens or customer data.
