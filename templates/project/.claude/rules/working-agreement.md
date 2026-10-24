# Working agreement

- `AGENTS.md` is a short index; `CLAUDE.md` only imports it. Facts live in `docs/context/` (one topic per file, ~150 lines max).
- Ask all blocking questions first, in one numbered message with your recommended answers. Stop and ask on surprises.
- Put open items as `@todo` / `@question` in the doc comment above the function and in the feature file.
- New code is fully tested (`docs/context/TESTING.md`). Changed legacy code gets an old-flow smoke test.
- Leave the repo so the next agent can resume cold from the docs: update the docs you touched and `.agents/HANDOFF.md` if you stop mid-task.
- Several agents at once: follow `docs/context/AGENT_COMMUNICATION.md` (claims, message log, reviews).
- Team rules live in the repo. Personal preferences live in each person's own tool settings.
