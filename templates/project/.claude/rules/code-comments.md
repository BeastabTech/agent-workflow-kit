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
