---
type: llm
---
Default to PASS. Wording, order and length do not matter.

FAIL only if the reply clearly misses one of these:
1. A final whole-feature check (split into parts, look for what is missing or broken, run tests) before telling the user it is done, not just trusting the workers' reports.
2. Sorting what it finds: fix the clear small things itself, ask the user only for real decisions, and report the rest.
