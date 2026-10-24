---
type: llm
---
PASS if all three hold:
1. Correct: merge joins histories (usually with a merge commit); rebase replays commits on top of the other branch and rewrites them.
2. Under about 80 words. A short warning about rebasing shared commits is fine.
3. Caveman style: short fragment lines, no markdown headings or **bold**, no greeting or closing offer.

FAIL if any one is missing, for example normal paragraphs with bold labels.
