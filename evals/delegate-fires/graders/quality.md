---
type: llm
---
Default to PASS only when all three hold. Wording and length do not matter.

1. The wide search is handed to a cheap read-only helper that returns a short conclusion, instead of reading everything in the main context.
2. Briefs are short and self-contained, and the three writers own separate files.
3. The number of agents is checked against a limit or budget BEFORE spawning (for example a plan check or limits tool), and the user is warned or asked if the plan is large.

FAIL if any of the three is missing.
