# Publishing

The kit ships as a Claude Code plugin from this GitHub repo (the repo is also its own marketplace), and as plain files for other tools. There is no npm package: `package.json` is `private`.

## Before each release

```bash
npm test                                            # all tests, must be green
claude plugin validate . --strict                   # manifest checks
claude plugin eval . --runs 1 --judge-model sonnet  # optional, spends tokens
node scripts/bench-presets.js --runs 3              # optional, spends tokens; add the table to docs/benchmarks/
```

1. Move the `Unreleased` block in `CHANGELOG.md` under a new version heading.
2. Bump the version in `package.json` and `.claude-plugin/plugin.json` (a test checks they match).
3. If you ran benchmarks, add the result file to `docs/benchmarks/` and update the README table. Say plainly when an edition did not beat no kit.

## Release

```bash
git switch -c release/0.2.0
git add -A && git commit -m "chore: release 0.2.0"
# open a PR to production, merge after CI is green on all three systems
git switch production && git pull
git tag v0.2.0 && git push origin v0.2.0
gh release create v0.2.0 --title "v0.2.0" --notes-file <(sed -n '/## 0.2.0/,/## 0.1.0/p' CHANGELOG.md | sed '$d')
```

Pushing to `production` and publishing a release are outward-facing: do them yourself, or tell the agent explicitly.

## How people install

```text
/plugin marketplace add BeastabTech/agent-workflow-kit
/plugin install agent-workflow-kit@agent-workflow-kit
```

The install asks for the edition (`preset`). Update with `/plugin marketplace update` then reinstall; pin a version by installing from a tag or ref. Other tools: clone the repo and run `node scripts/init-project.js --target <dir> --preset <name>`.

## Optional: the official directory

Submit the plugin for listing through the form linked from the Claude Code plugin docs. The repo needs a README, a license (MIT, present), a working `claude plugin validate`, and no personal data (the lint test checks this).

## After release

Watch issues using the "Benchmark result" template, and rerun `bench-presets.js` when an edition changes.
