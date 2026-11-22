# Publishing

The kit ships three ways from one repository:

| Channel | What people run | Updated by |
|---|---|---|
| Claude Code plugin | `/plugin marketplace add BeastabTech/agent-workflow-kit` | pushing to `production` |
| GitHub, any tool | `npx github:BeastabTech/agent-workflow-kit#stable <command>`, `uses: ...pr-check.yml@stable` | moving the `stable` branch |
| npm | `npx @beastab/agent-workflow-kit <command>` | `npm publish` from the `beastab` npm account, which needs a security key or passkey as 2FA (the unscoped name `agent-workflow-kit` belongs to someone else) |

## Stable channel

`stable` is a branch that always points at the release people should use by default. A new release does not move it: publish first, let it prove itself, then promote.

```bash
git push origin v0.5.0^{commit}:refs/heads/stable   # promote; a fast-forward, never a force push
gh release edit v0.5.0 --latest                     # the release page shows the same one as latest
npm dist-tag add @beastab/agent-workflow-kit@0.5.0 stable   # once the package is on npm
```

To release a version that is not stable yet, create its GitHub release with `--prerelease` and publish to npm with `--tag next`; promote it later with the three commands above.

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
npm publish                                        # reads publishConfig.access = public; add --tag next for a not-yet-stable version
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
