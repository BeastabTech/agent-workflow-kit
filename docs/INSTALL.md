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

Then open your repo in Claude Code and say **"set up the agent workflow here"**. The `init` skill reads the repo, asks seven questions it cannot guess (edition, project, commands, branches, agent tools, state sync, `.gitignore` additions) and writes the files. Settings it did not ask about (`owners`, `protectedFiles`, `workMode`, `commitPolicy`, `timezone`, `mergeFlow`) keep their defaults, are listed under `"unset"` in `.agents/config.json`, and are asked one at a time when a task first needs them. Restart Claude Code if the skills do not show up.

Check it worked: type `/agent-workflow-kit:` and the skill list appears.

## Any agent, one command (no clone)

From your repo's root folder:

```bash
npx github:BeastabTech/agent-workflow-kit#stable init --tools claude,codex,cursor,gemini,copilot --with-git-hooks
npx github:BeastabTech/agent-workflow-kit#stable export-skills --to agents
```

The same commands from npm: `npx @beastab/agent-workflow-kit init ...` (the default version there is the latest release; add `@stable` after the name for the stable one).

`#stable` is the release the maintainers marked stable; use a tag such as `#v0.5.1` to pin one version. `init` writes the files every agent tool reads (`AGENTS.md` and the per-tool pointers), so whichever agent works in the repo afterwards follows the same rules. Commit what it wrote. Add `--dry-run` to preview, `--preset lite|low-tokens|auto|normal|best` to pick the edition.

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

From the project (shows the list first, deletes only with `--yes`):

```bash
npx github:BeastabTech/agent-workflow-kit#stable remove
npx github:BeastabTech/agent-workflow-kit#stable remove --yes
git config --unset core.hooksPath          # only if you turned the git hooks on
claude plugin uninstall agent-workflow-kit@agent-workflow-kit   # only if you installed the plugin
```

`remove` reads `.agents/kit-manifest.json`, the list of files `init` and `export-skills` wrote with a hash of each. It deletes a file only when it is still exactly what the kit wrote, so an `AGENTS.md` you edited or a filled-in `STATE.md` stays and is listed; `--force` removes those too. It also deletes the kit's local state folders and takes the kit's lines out of `.gitignore`. It never touches a file the kit did not write, and it leaves `.agents/LOG.md` (your message log). A project set up before version 0.5.0 has no manifest: the command lists the kit's paths and removes nothing.

Without npx, from a clone of the kit: `node ../agent-workflow-kit/scripts/remove-project.js --target . --yes`.
