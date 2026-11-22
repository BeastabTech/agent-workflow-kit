# Working on agent-workflow-kit

This file is for an agent (or person) changing the kit itself. Users of the kit read `README.md`. The file the kit writes into other projects is `templates/project/AGENTS.md`, not this one.

## What this repository is

One repository shipped three ways: a Claude Code plugin (`.claude-plugin/`, `skills/`, `agents/`, `hooks/`), an npm package with a CLI (`bin/`, name `@beastab/agent-workflow-kit`), and a reusable GitHub workflow (`.github/workflows/pr-check.yml`). All code is plain Node.js 18+, **no dependencies**: do not add any.

## Map

| Path | What | Read first when |
|---|---|---|
| `skills/<name>/SKILL.md` | Instructions an agent loads on demand. The `description` line is loaded in every session | changing how agents behave |
| `agents/*.md` | Sub-agent definitions (single source; exported to other tools by `scripts/lib/agents.js`) | changing a sub-agent |
| `hooks/hooks.json`, `scripts/hooks/*.js` | Claude Code hooks: one script per event | changing a guard |
| `scripts/lib/*.js` | Shared logic, unit-tested. `config.js` loads settings, `budget.js` counts spawns, `resources.js` reads the machine, `secrets.js` scans, `pr-review.js` is the PR check's pure part, `manifest.js` records installs | changing behaviour |
| `scripts/init-project.js`, `remove-project.js`, `export-*.js` | Set a project up, undo it, copy skills and agents | changing install or removal |
| `scripts/agent-*.js`, `git-guard.js` | Tools `init` copies into a project's `.agents/tools/` | changing a project tool |
| `templates/` | Files `init` writes into a project (`{{VARS}}` filled by `init-project.js`) | changing what projects get |
| `docs/` | User docs, one topic per file | always, for the topic you touch |
| `tests/*.test.js` | `node:test`, run by `tests/run.js` | always |

## Commands

```bash
npm test                              # every test; must pass on Linux, macOS and Windows
node --test tests/edge.test.js        # one file
claude plugin validate . --strict     # plugin manifest
npm run stats                         # footprint numbers quoted in docs/BENCHMARK.md
npm publish --dry-run                 # what the npm package would contain
```

## Rules for a change

1. **Hooks fail open.** A hook that throws or gets broken input lets the action through; it never blocks on its own error. It blocks or asks only for a clear case, and its message names the fix.
2. **A rule that can be a check is a check.** Prefer a hook, a test or a lint over another sentence in a skill. Skill text is for judgment.
3. **Every behaviour change has a test** in `tests/`, and the test fails without the change. Tests build fake credentials at runtime (`tests/helpers.js`); never write a real-looking key into a file.
4. **Keep what is always loaded small.** Skill and agent `description` lines cost tokens in every session. `tests/lint.test.js` compares `docs/BENCHMARK.md` with `npm run stats`; when a description or template changes size, update the numbers there, do not loosen the test.
5. **One change, all its places.** A new check or setting touches: the code, a test, `docs/HOOKS.md` or `docs/CONFIG.md`, the README table if it lists the thing, `CHANGELOG.md` (under `Unreleased`), and `scripts/init-project.js` if projects need it written. A file `init` copies into projects must be added to its `sources` list.
6. **Comments say why.** Each script starts with a header: what it does, how it is called, what it reads and writes. Update the header when the behaviour changes. No comment that restates the code or excuses a shortcut.
7. **Plain words.** Docs and skills are read by people and agents whose first language may not be English: short sentences, concrete nouns, no idioms.
8. **No AI attribution** in commits, PRs or releases (the kit's own hook blocks it).

## Traps that cost time before

- The kit's hooks run on your own commands in this repository. A command whose text contains a blocked phrase (for example a destructive-database command name inside a doc string you are editing, or an attribution phrase inside a `grep`) is stopped. Change the text of the command, not the hook.
- Hook state is written to `.agents/.budget/` in whatever repository the plugin runs in, this one included. The folder ignores itself; do not add it to git.
- `git merge-tree --write-tree` needs git 2.38 or newer; tests that use it tolerate older versions.
- `npx @beastab/agent-workflow-kit ...` fails with "command not found" when run inside this folder, because npx finds a package of the same name here. Try it from another folder.
- Windows: paths use `path.join`, tests must not assume `/`, and a checkout may have CRLF line endings (hashes in `manifest.js` normalise them).

## Release

Only when the maintainer asks, in that conversation. Steps and the stable channel are in `docs/PUBLISHING.md`: move `Unreleased` in `CHANGELOG.md` under the new version, bump `package.json` and `.claude-plugin/plugin.json` together, push, wait for CI on all six jobs, tag, create the GitHub release. `npm publish` and moving `stable` are the maintainer's decisions.
