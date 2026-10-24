---
type: llm
---
Default to PASS only when all three hold. Wording and length do not matter.

1. The wide search is handed to a cheap read-only helper that returns a short conclusion, instead of reading everything in the main context.
2. Briefs are short and self-contained, and the three writers own separate files.
3. The plan's number of agents (and how many run at once) is counted and checked against a limit or budget BEFORE spawning, and the user is told that count (or any warning) before work starts.

FAIL if any of the three is missing.
