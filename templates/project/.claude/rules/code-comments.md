# Owner + summary comments

- New modules, services, jobs, consumers, adapters and major functions (public service methods; anything with side effects, state changes, money or permissions) start with:
  ```
  /**
   * @owner <human owner from docs/context/MODULE_MAP.md>
   * @summary <one line: what and why>
   * @sideEffects <only if any>
   */
  ```
- `@owner` is the human owner, never the tool or agent that wrote the code.
- When you edit an existing major function, add or refresh its header. Do not back-fill untouched files.
- Keep comments 2–5 lines. Do not restate the code. Match the surrounding comment density.
- A comment says **why**: the constraint, the trap, the decision and its date or ticket. What the code does belongs in names and types.
- No comment that excuses a shortcut ("temporary", "quick fix", "for now", "hack"). Fix it, or leave a `@todo` with an owner and what has to happen first.
- A comment your change makes false is deleted or corrected in the same change. A stale comment misleads the next agent more than no comment.
- Something that must always hold (never call X from Y, this list stays sorted) is a test, a type or a lint rule, not a comment.
