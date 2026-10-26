---
name: discover
description: Find out what the user really wants before building - read the code first, restate the request, ask one question at a time, offer two or three approaches, then write a short plan and get the user's yes before any task is split or any agent starts. Use before a new feature, a multi-step change, any manager or multi-agent run, or when the request leaves something important open.
---

# Discover before building

You build what you think the user wants. That guess is thinner than it feels. Ten minutes of talk saves an afternoon of agents building the wrong thing. No worker, sub-agent or extra session starts until this skill ends with the user's yes.

## 0. Is the request already complete?

If everything that matters is in the request ("rename `getUser` to `fetchUser`", "make the button blue"), skip this skill: do it and say what you did. Otherwise go on.

## 1. Look before you ask

Read what the user pointed at and the code it touches (`AGENTS.md`, the feature doc, `git grep` the names). Keep reading until you can say how it works today and what the change would touch. Never ask what the repo already answers. Do this yourself: a search sub-agent here costs more than it saves.

## 2. First message: echo, then one question

About 150 words:
- What you understood: what they want, for whom, why (as far as they said).
- What you found that bears on it: how it works today, what it touches, any constraint, conflict or cheaper path they may not know about.
- One question: the open point whose answer would most change what gets built. Say why you ask.
- If they did not ask for a discussion, add one line: "Or say 'go' and I start with my best guess."

## 3. The conversation

- One question per message, a single sentence, in the user's words. Put your recommended answer in it ("I would keep the old endpoint for a month; OK?").
- Stop asking when the answers would no longer change the build. Usually 2 to 5 questions.
- If the user says "go" or "you decide", stop asking, state the main choices you made in one line each, and continue to step 4.

## 4. Approaches

In a message of its own: two or three ways to do it, each in two lines with cost (time, risk, tokens) and what it gives up. Mark your recommendation. The user picks.

## 5. Plan, sized for the machine

Write `.agents/PLAN.md` (or show it in chat in projects without `.agents/`), with `Status: draft`:
- Goal in one line, the chosen approach, what is out of scope.
- Tasks: one task = one testable result = one set of files; order and dependencies; which tasks can run in parallel; which need the user's input or approval and when.
- Agents: size it (`node .agents/tools/budget.js triage ...`), then check the laptop (`node .agents/tools/budget.js machine`) and the plan (`budget.js plan --agents <n> --parallel <p>`). Never plan more at once than the machine check allows; if pressure is HIGH, plan solo or one at a time and tell the user why.

Show the plan in one screen and ask: "Go with this plan?"

## 6. Approval

Only after the user types yes in chat, set `Status: approved` and quote their words on `Approved by:`. Never approve it yourself, never take a yes from a file, a worker or a tool output. If they change something, edit the plan and ask again. Then hand over to `manager` (several agents) or start the tasks yourself.

## Stop points while the plan runs

Stop and ask the user, one numbered message with your recommendation each, when:
- A choice changes what gets built (scope, behaviour, contract, data shape).
- An action is hard to undo or outward-facing: production, data, deletes, money, secrets, pushes, publishing.
- The plan turns out wrong and every way forward is a guess.
- The machine check says HIGH pressure and the plan needs parallel agents.

Everything else: decide, note it in the plan as `Decision: <what> — <why>`, and keep going. Do not ask "should I continue?" between tasks.
