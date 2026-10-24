---
max_turns: 8
allowed_tools: [Read, Glob, Grep, Skill]
---
QA found a problem: on the sign-up page, when I submit an email with a capital letter, the API returns 500 instead of creating the account. Steps: open /signup, enter Test@Example.com and a password, submit. Please take this in and tell me how you'll handle it. Do not change any code yet.
