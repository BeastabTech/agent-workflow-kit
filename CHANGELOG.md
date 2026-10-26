# Changelog

## 0.3.1

Review pass over 0.3.0; no new features.

- Plan lifecycle: the manager sets `Status: done` in `.agents/PLAN.md` after closeout, so the next goal is gated again instead of riding the first approval for the life of the repo. The `discover` and `plan` skills keep the template's `Status:` line; the plan-skill chat block is for projects without `.agents/`.
- Worktrees: the plan gate reads `PLAN.md` in the current checkout first, then the main checkout.
- Read-only agents with any prefix or hyphenated name (`ecc:code-reviewer`, `code-explorer`, `architect`, `analyzer`, `guide`) pass the plan gate; only agents that change things are gated.
- A spawn that ends in a question is no longer counted as running, so a declined spawn leaves no phantom agent that makes later checks ask too early.
- `planGate: "false"` or `0` in `.agents/config.json` turn the gate off; the session-start note about discovering first appears only when the gate is on.
- `low-tokens` (one agent at a time) gets one question from the budget check, not a second one from the machine check.
- Running agent sessions are detected by the command path (`claude`, `codex`, `gemini`, or node running `claude-code` / `gemini-cli`), paths with spaces included; the desktop app's helper processes and wrapper processes no longer count.
- Skill text aligned: one question at a time during discovery, batched once the plan runs; read the code yourself, an explorer only for dozens of file reads. New eval `discover-fires`. Templates, planner agent and docs mention `PLAN.md` and `budget.js machine`.

## 0.3.0

- Talk first, then build: new `discover` skill. The agent reads the code itself, restates the request, asks one question at a time with its recommendation, offers two or three approaches for the user to pick, writes a one-screen plan and waits for the user's yes. It lists the stop points where a running plan must wait for the user (scope choices, hard-to-undo actions, a broken plan, machine pressure) and decides the rest itself.
- Plan gate: `.agents/PLAN.md` (new template) holds the agreed plan. A worker sub-agent started before it says `Status: approved` asks the human; read-only helpers (explorer, planner, reviewer) are not gated. Off with `planGate: false`, `AWK_DISABLE=plan-gate` or the `minimal` profile.
- Machine check: `scripts/lib/resources.js` reads free memory (vm_stat on macOS, MemAvailable on Linux), CPU load and the coding-agent processes already running, and works out how many agents the machine can run at once. `budget.js machine` prints it; `budget.js plan` and `triage` cap parallel work by it; the spawn hook asks before a spawn would go over it and warns under high pressure; the session-start note shows it. New limits: `machineCheck`, `agentMemMB`, `memReserveMB`, `cpuPerAgent`. `AWK_MACHINE=off` turns it off for one shell.
- The `manager` skill now runs in a fixed order: resume, discover with the user, size and split, check the machine and the budget, get the yes, then spawn in waves and re-check the machine before each wave. `plan` and `delegate` point to the same steps; `low-tokens` also exports `discover`.

## 0.2.1

- Done gate: a Stop hook that, after code edits, requires a test run and a test file before the agent may finish; capped at two blocks per session. Only the `best` edition uses it (in the benchmarks it cost 20 to 90 percent more tokens on small tasks for no change in results, so `normal`, `auto` and `low-tokens` do not).
- README states plainly what the kit is (safety net, shared memory, hand-off) and what it is not (a measured gain in code quality or tokens), with the benchmark table.
- Benchmarks on real tasks in a small and a large project (`scripts/bench-real.js`, `bench-summary.js`, `docs/benchmarks/real-tasks.md`): no edition beat no kit beyond noise. Measured numbers moved from the README to `docs/BENCHMARK.md`; edition descriptions no longer claim better quality.

## 0.2.0

- `auto` edition and `budget.js triage --task "<request>"`: the kit estimates files, reads, parts and risk from the task text and the repo, then decides mode, model tier, agents and review.
- Loops: `loop` skill and `loop.js` (`start`, `check`, `step`, `status`, `stop`) with a round limit, a stuck detector and a clear DONE, CONTINUE or STOP verdict; `/loop` for recurring and watch jobs.
- Measured editions on one coding task: `docs/benchmarks/presets-coupons.md`.
- Editions (`lite`, `low-tokens`, `normal`, `best`), chosen at install: plugin option `preset`, `init --preset` (asks in a terminal), first question of the `init` skill, `preset` in `.agents/config.json`, `AWK_PRESET`. Each sets hook profile, spawn limits, reply style and a session note; `lite` and `low-tokens` install a compact `AGENTS.md`, export only core skills and add git hooks. `docs/EDITIONS.md`.
- `budget.js triage`: size the problem first (files, reads, parts, risk), then get mode, model tier, agent count and review; the manager and delegate skills start with it.
- `scripts/bench-presets.js` and a coupon fixture with hidden tests to compare editions against no kit.
- Less spend by default: the `manager` skill now starts with a triage (solo, one sub-agent, or several; risky code gets a reviewer), `delegate` defaults to solo, a hook warns when an `explorer` starts in a repo under `limits.smallRepoFiles` (400) tracked files, and 12 long skill and agent descriptions were shortened (always-loaded cost ~4.2k to ~3.8k tokens).
- Repo hygiene: tests for broken markdown links and version sync between `package.json` and `plugin.json`, `.editorconfig`, Dependabot for GitHub Actions, `repository` in `package.json`.
- Hook profiles `minimal` / `standard` / `strict` (`AWK_PROFILE`, plugin option `profile`, `profile` in `.agents/config.json`).
- `lessons` skill: record non-obvious causes in the right doc, without duplicates, and promote to a rule only when it recurs.
- Measured results in the README: a delegation micro-benchmark (the sub-agent cost about 6.7 times the tokens on a small search, no main-context saving), plugin eval results, and the always-loaded cost. `scripts/bench-delegation.js` reruns it; raw data in `docs/benchmarks/`. The `delegate` skill now tells agents to do `git grep`-sized searches themselves.
- Eval results: `closeout-fires` +1.00 and `delegate-fires` +1.00 against no plugin (1 run each). The delegate skill now sizes the plan and checks the limits first.
- CI actions moved to v7 (Node 24 runtime).
- Evals: the delegate and closeout graders now check kit-specific behaviour, so the with/without difference means something.
- Spawn budget: `limits` in `.agents/config.json`, a PreToolUse hook on the `Agent` tool that counts sub-agents, warns near a limit and asks the user when one would be crossed, a SubagentStop hook, and `budget.js plan|status|limits` for managers to check a plan before spawning. Verified end to end in Claude Code.
- New agents: `planner`, `test-writer`, `build-fixer`, `doc-updater`. New skills: `delegate` (small briefs, small reports, when not to spawn), `team-status`.
- Talking to the team: `msg.js roster`, an `instruction` message type (never an approval), and manager rules for relaying a user's instruction to any worker or stepping into a worker session.
- Agents for Codex and Cursor are generated from `agents/*.md` by `init` and `export-agents.js` (Codex and Cursor only; replaces the two hand-written Codex files).
- `npm run stats` (static footprint) and `scripts/session-stats.js` (real token numbers from a session transcript), `docs/BENCHMARK.md`.
- Windows, macOS and Linux: LF via `.gitattributes`, CRLF-tolerant parsers, Git Bash `/c/x` paths for `git -C`, real-path comparison, `git grep` in skills, a cross-platform test runner and a three-OS CI matrix.
- Community: code of conduct, issue and pull request templates, contributing guide.
- New `closer` agent and `closeout` skill: after the workers finish, split the feature into parts, hunt for missing or broken pieces, fix clear small gaps, ask the human only for real decisions, re-test, and send the manager a Closeout report (`msg.js` type `closeout`). The manager skill runs it before saying "done".
- Fix: protected-file and env-file checks missed edits when the tool passed a symlinked path (for example `/var` vs `/private/var` on macOS).
- `init` no longer adds a second copy of a doc the project already keeps elsewhere (matched by file name, any case). It links to the existing one and lists it under `existing`.
- `msg.js post` prints `posted: <header>` so it is not mistaken for a second copy of the message.

## 0.1.0

First release.

- Claude Code plugin with a marketplace in the same repo.
- 33 skills: setup and memory, multi-agent orchestration, everyday engineering, backend and data, frontend and apps, cloud and release, skill testing.
- 4 agents: reviewer, explorer, security-reviewer, qa-tester.
- Hooks: AI trailer block, secret scan, explicit staging, force push, protected branches, destructive DB commands, protected and env files, session-start notes (including after compaction).
- `init-project.js`: writes `AGENTS.md`, per-tool adapters (Claude, Codex, Cursor, Gemini, Copilot), `docs/context`, team rules, `.agents` state and the message tool.
- `export-skills.js`: copies skills for other agents.
- `git-guard.js`: tool-neutral commit checks.
- Tests (`node --test`) and behaviour evals (`claude plugin eval`).
- Quick start in the README and a step-by-step guide in `docs/INSTALL.md`.
