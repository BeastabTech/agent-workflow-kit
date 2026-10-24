---
name: team-message
description: Draft one self-contained hand-off message for another team (frontend, mobile, QA, support, partners) that needs no repo access - the full flow step by step, request and response samples with field notes, types, errors with the UI action, what is not live yet. Use when work is ready to share with another team or a tester, or when asked to write a hand-off, integration guide or release note for people outside this repo.
---

# Team hand-off message

The readers have no access to this repo and will not open attachments. Everything they need is in the message.

## Before drafting

- Confirm what is deployed where. Never describe something as live before it is.
- Read the real request and response shapes from the code or API docs, not from memory.
- Ask the human who the audience is and which environment they will use.

## Shape (split into numbered parts if long)

1. **What changed and why** — two or three lines in plain words.
2. **Where** — environments and base URLs as placeholders (`<base URL>`); the readers know the real ones.
3. **Flow** — numbered steps from the user's point of view, each with the call it makes.
4. **Per endpoint or event:**
   - method and path, required headers (auth as `Bearer <token>`);
   - a copy-paste example (curl or code);
   - sample request and response JSON with inline `//` notes per field: type, required or optional, allowed values;
   - errors: status, code, message, and what the UI should do.
5. **Types** — one block of TypeScript (or the readers' language) types they can paste.
6. **Not live yet / known gaps** — with expected dates only if the human gave them.
7. **Where to find more** — the API docs link as a placeholder (`<base URL>/docs`).

## Rules

- No repo paths, internal code names, ticket ids, infra identifiers, secrets, real tokens or personal data.
- Sample data is clearly fake (`test+1@example.com`, `TEST_` codes).
- One language, plain words, short sentences.
- The human sends the message. Hand it to them as a file or a fenced block, and say what must be deployed first.

Template: `templates/message.md`.
