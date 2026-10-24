# Contributing

Thanks for helping. Anyone can contribute: skills, agents, hook checks, adapters for more tools, docs, and benchmark results ([docs/BENCHMARK.md](docs/BENCHMARK.md)). Keep the kit small, generic and dependency-free. Be kind: [code of conduct](CODE_OF_CONDUCT.md).

## Rules
- **Generic only.** No company, product, person or infrastructure names, ids, emails or secrets in skills, templates, examples or tests. Use placeholders like `<owner>`, `<project-id>`.
- **Plain Node.js** (the version Claude Code ships with or newer), no npm dependencies in hooks or scripts.
- **Hooks fail open** and block only clear cases. Every new check gets an off switch and tests for: block, allow, broken input.
- **Skills**: `description` says what it does and when to use it; keep `SKILL.md` short and put long material in files beside it. Side-effecting skills use `disable-model-invocation: true`.
- **Templates**: one topic per file, about 150 lines at most. Placeholders are `{{UPPER_CASE}}` and must all be filled by `init-project.js`.
- Fake credentials in tests are built at runtime (see `tests/helpers.js`) so the repo never contains one.

- **Works on macOS, Linux and Windows.** Use `path` for paths, `git grep` instead of `grep` in skills, no shell-only syntax in scripts, no symlink or permission tricks in tests (use a junction), and accept CRLF input. CI runs all three.
- **Agents** live once in `agents/*.md`; `scripts/lib/agents.js` renders them for Codex and Cursor. Read-only agents must not list `Write` or `Edit`.
- **Estimates are labelled.** Never present a guess as a measurement; the budget checker and `npm run stats` say "estimate" for a reason.

## Add something
- Skill: `skills/<name>/SKILL.md`, then add it to the README table. Agent: `agents/<name>.md`. Hook check: a function in `scripts/hooks/`, an entry in `docs/HOOKS.md`, tests.
- Add an eval under `evals/<name>-fires/` when a skill must trigger on a certain kind of request.

## Before a pull request
```bash
npm test
claude plugin validate . --strict
claude plugin eval . --runs 1 --judge-model sonnet --case '<the case you touched>'   # if you changed a skill's description or behaviour
```

Commits use conventional commits (`feat(skills): add x`, `fix(hooks): y`), with no AI attribution trailers.
