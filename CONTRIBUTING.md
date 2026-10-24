# Contributing

Thanks for helping. Keep the kit small, generic and dependency-free.

## Rules
- **Generic only.** No company, product, person or infrastructure names, ids, emails or secrets in skills, templates, examples or tests. Use placeholders like `<owner>`, `<project-id>`.
- **Plain Node.js** (the version Claude Code ships with or newer), no npm dependencies in hooks or scripts.
- **Hooks fail open** and block only clear cases. Every new check gets an off switch and tests for: block, allow, broken input.
- **Skills**: `description` says what it does and when to use it; keep `SKILL.md` short and put long material in files beside it. Side-effecting skills use `disable-model-invocation: true`.
- **Templates**: one topic per file, about 150 lines at most. Placeholders are `{{UPPER_CASE}}` and must all be filled by `init-project.js`.
- Fake credentials in tests are built at runtime (see `tests/helpers.js`) so the repo never contains one.

## Before a pull request
```bash
node --test tests/*.test.js
claude plugin validate . --strict
claude plugin eval . --runs 1 --judge-model sonnet --case '<the case you touched>'   # if you changed a skill's description or behaviour
```

Commits use conventional commits (`feat(skills): add x`, `fix(hooks): y`), with no AI attribution trailers.
