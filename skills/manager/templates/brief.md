# Brief: <task name>

**Goal:** <one or two sentences: the outcome, not the steps>

**Context you need:** read `AGENTS.md`, then <the 1–3 docs that matter>. <Facts the worker cannot find in the repo: decisions, answers from the owner.>

**Files you own:** <paths>. Do not edit other files; ask through the log if you must.

**Constraints:**
- Additive only; new behaviour behind `<FLAG>` (default off).
- Protected files touched? <none / which; owner OK needed on the diff>.
- Work mode: <shared: claim + explicit staging | worktree: branch `<name>`>.
- Commit: <only when asked | allowed on your branch>. Never push to <protected branches>.

**Done means:** <tests or checks that must pass>, old-flow smoke of <flow>, docs updated (<files>), Done report per `docs/context/DEFINITION_OF_DONE.md`.

**Ask first:** send all blocking questions in one numbered message with your recommendation, to `manager`. Approvals for <risky actions> must come from the human typed in your session.

**Report:** `node .agents/tools/msg.js post --from <you> --to manager --type done --topic "<task name>"` with the Done report as the body. Then stop.
