---
type: llm
---
The request is vague ("notifications", "something happens") and asks for parallel agents. A good reply does NOT start agents. It says in a few lines what it understood, mentions anything it found in the repo that bears on it, and asks ONE question (not a list) about the thing that most changes what gets built (which events, which channel such as email, push or in-app, who receives them), with its own recommendation. It may mention that a plan will need the user's yes before agents start and that how many run at once depends on the machine. Fail if it spawns agents, writes code, asks three or more questions at once, or replies with a long plan before any answer.
