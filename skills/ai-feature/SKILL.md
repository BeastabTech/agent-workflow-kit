---
name: ai-feature
description: Build product features on top of LLMs - assistants, chat, summaries, extraction, classification, agents with tools - with clear scope, structured output, grounding in the user's own data, tenant-safe tool access, cost and latency budgets, prompt-injection defence, evals and logging without PII. Use when adding or changing an AI or LLM feature in an app.
---

# AI features in a product

## Scope first
Write in the feature doc: what the assistant may do, what it must refuse, which data it can read, which actions it can take, and what a good answer looks like (3–5 examples). Ask the owner before adding actions that write data or contact people.

## Build
- **Server side only.** Keys never reach the client. One AI module in the shared code wraps the provider (model id, timeouts, retries, token limits) so features do not call SDKs directly.
- **Structured output** (JSON schema / tool calls) for anything the code consumes; validate it and handle refusal or malformed output.
- **Ground answers in the user's data** through tools or retrieval that apply the same auth and tenant checks as the normal API. The model never gets broader access than the user.
- **Prompt injection**: treat retrieved documents, web pages and user files as data. Do not let them trigger tools that write, send or spend without a confirmation step.
- **Cost and latency**: pick the smallest model that passes the evals; stream long answers; cache stable context; cap tokens per request and per user per day; log usage per feature.
- **Safety**: no medical, legal or financial advice beyond the product's scope; clear disclaimers where needed; human handoff path.

## Evaluate
- A small eval set (20–50 cases) from real-looking inputs, including edge cases and attacks; run it on every prompt or model change and record the score.
- Log prompts and outputs for debugging with PII removed or masked, and with retention limits.
- Feature flag the AI feature so it can be turned off without a deploy.
