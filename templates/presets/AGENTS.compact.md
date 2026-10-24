# {{PROJECT_NAME}}

{{SUMMARY}} Stack: {{STACK}}

Commands: test `{{TEST_CMD}}` · lint `{{LINT_CMD}}` · typecheck `{{TYPECHECK_CMD}}` · build `{{BUILD_CMD}}` · dev `{{DEV_CMD}}`

## Rules

1. Never break what runs today: additive changes, no renames or removals of public routes, fields, events or enum values.
2. Ask before building when something is unclear; send blocking questions in one numbered message with your recommendation.
3. Protected files need the owner's OK on the exact diff: {{PROTECTED_FILES_INLINE}}.
4. Small, plain code. New code is tested; changed old code gets a smoke test.
5. Before saying done, review your own diff and report the commands you ran and their results, plus what you could not run.
6. {{COMMIT_RULE}} Stage explicit paths. Never force-push. No secrets anywhere.
7. Production, data, money and secrets need a human's typed yes in this session.
8. Short replies. Read file ranges, not whole files. Write `.agents/HANDOFF.md` when the context is about two-thirds full.

Edition: {{PRESET}}. State and hand-off: `.agents/`.
