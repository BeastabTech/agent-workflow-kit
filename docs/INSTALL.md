# Install

Pick your tool. Each path takes two or three steps.

## Claude Code

Inside Claude Code:

```text
/plugin marketplace add BeastabTech/agent-workflow-kit
/plugin install agent-workflow-kit@agent-workflow-kit
```

Or from a terminal:

```bash
claude plugin marketplace add BeastabTech/agent-workflow-kit
claude plugin install agent-workflow-kit@agent-workflow-kit
```

Then open your repo in Claude Code and say **"set up the agent workflow here"**. The `init` skill asks a few questions and writes the files. Restart Claude Code if the skills do not show up.

Check it worked: type `/agent-workflow-kit:` and the skill list appears.

## Codex, Cursor, Gemini CLI, Copilot or any other agent

Run these from your repo's root folder:

```bash
git clone https://github.com/BeastabTech/agent-workflow-kit ../agent-workflow-kit
node ../agent-workflow-kit/scripts/init-project.js --target . --tools codex,cursor,gemini,copilot --with-git-hooks
node ../agent-workflow-kit/scripts/export-skills.js --target . --to agents
```

- Keep only the tools you use in `--tools`.
- `--to` picks where skills go: `agents` (`.agents/skills`, read by Codex and others), `codex`, `cursor`, `gemini` or `claude`. You can list several, separated by commas.
- Without `--answers` you get sensible defaults. Fill in `AGENTS.md` and `docs/context/` afterwards, or start from [templates/answers.example.json](../templates/answers.example.json) and pass `--answers answers.json`.

Optional: turn on the git guard (it blocks secrets and AI commit trailers for every tool). This changes the repo's git config, so it is your choice:

```bash
git config core.hooksPath .githooks
```

Check it worked: `AGENTS.md` exists, and your agent mentions it when you ask "what are the rules in this repo?".

## Both at once

Install the plugin for Claude Code users, and commit the files from `init` so everyone else on the team gets the same rules.

## Update

```bash
claude plugin marketplace update agent-workflow-kit
claude plugin update agent-workflow-kit@agent-workflow-kit
```

Without the plugin, run `git -C ../agent-workflow-kit pull`, then the two `node` commands again. Existing files are kept. Add `--force` to overwrite them, and `--dry-run` to preview first.

## Remove

```bash
claude plugin uninstall agent-workflow-kit@agent-workflow-kit
git config --unset core.hooksPath
```

The files `init` wrote are ordinary files in your repo. Delete the ones you do not want.
