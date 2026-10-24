---
name: skill-testing
description: Test Claude Code skills, agents, hooks and plugins - validate manifests, unit-test hook scripts with sample inputs, write eval cases (prompt plus graders) that check a skill fires and does the right thing, run them with claude plugin eval, and compare against a no-plugin baseline. Use when creating or changing a skill, agent, hook or plugin, or when asked to test or benchmark one.
---

# Skill and plugin testing

## 1. Static checks (free, every change)
```bash
claude plugin validate <plugin-dir> --strict      # manifest, paths, frontmatter
```
- Each `SKILL.md` has a `description` that says what it does **and when to use it**, with the words users actually type.
- Side-effecting skills (deploy, publish, send) have `disable-model-invocation: true`.
- `SKILL.md` stays short (well under 500 lines); long material goes in files next to it.

## 2. Hook unit tests
Hooks read JSON on stdin and answer on stdout. Test them like functions:
```bash
echo '{"tool_name":"Bash","tool_input":{"command":"git commit -m \"x\""},"cwd":"'$PWD'"}' | node scripts/hooks/pre-bash.js
```
Write `node --test` cases for: a clear block, an ask, a pass-through, a broken input (must not block), and the off switch. This repo's `tests/` folder is a working example.

## 3. Behaviour evals
Cases live in `evals/<case>/prompt.md` + `evals/<case>/graders/*.md`:

```markdown
---
max_turns: 8
allowed_tools: [Read, Glob, Grep, Skill]
---
<the request, phrased the way a user would type it, not naming the skill>
```

Graders:
- `type: tool_used`, `tool: Skill`, `input_match: '"skill"\s*:\s*"(?:[\w-]+:)?<skill>"'` — the skill fired.
- `type: regex` — a required phrase or format appears.
- `type: llm` — a PASS/FAIL rubric for quality.
- A negative case: an unrelated request where the skill must **not** fire (`min: 0`, `max: 0`, `arm: both`).

Run:
```bash
claude plugin eval <plugin-dir> --runs 1 --case '<glob>'     # quick
claude plugin eval <plugin-dir> --runs 3 --judge-model sonnet # before release; compares with a no-plugin baseline (the default haiku judge misreads long answers)
```
Each run costs model tokens; start with `--runs 1` on one case. Add `evals/results/` to `.gitignore`.

## 4. Real install test
In a throwaway repo: add the marketplace from the local folder, install, start a session, run the skill on a realistic request, and check the files it wrote. Remove the test marketplace afterwards.

## Report
Validation result, hook test counts, eval scores per case (with and without the plugin), and what was not tested.
