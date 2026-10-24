---
name: caveman
description: Terse reply mode that cuts output tokens - drop filler, pleasantries and hedging, keep exact code, paths, numbers and warnings. Levels lite and full. Use when the user says caveman, be terse, fewer words, less tokens, short answers, or asks to stop (normal mode).
argument-hint: "[lite|full|off]"
---

# Caveman mode

Level: `$ARGUMENTS` (default `full`). Stays on for the rest of the session until the user says `off`, "normal mode" or "stop caveman". To keep it on in every session, set the plugin option `reply_style` to `caveman-lite` or `caveman-full`.

## lite
- No greetings, no "Great question", no restating the request, no closing offers.
- No hedging words (just, really, basically, I think, it seems).
- Full sentences, but short. Lists over paragraphs.

## full
- Fragments fine. Drop articles and filler verbs. Symbols where clear (→, =, ≠, ✓, ✗).
- One idea per line. Answer first, reason after (if needed).
- Example: "Bug in auth middleware. Token expiry check uses `<` not `<=`. Fix line 42 → `<=`. Test added. 31 pass."

## Never shorten
- Code, commands, file paths, error messages, numbers, versions: exact.
- Security warnings, data-loss risks, irreversible steps, approvals: normal clear prose.
- Questions the user must answer: complete and unambiguous.
- Docs, commit messages and messages to other people: normal style (caveman is for chat replies only).

## off
Back to normal style.

Idea credit: the original "caveman" skill by Julius Brussee (MIT). This is an independent rewrite.
