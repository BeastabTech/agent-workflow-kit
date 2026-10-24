---
name: webapp-testing
description: Test a running web app end to end in a real browser - start the dev server, drive user flows with Playwright (or the session's browser tool), assert on visible results, capture screenshots and console or network errors, and turn the flows into repeatable e2e tests. Use to verify a frontend change works, reproduce a UI bug, smoke-test a release, or write e2e tests.
---

# Web app testing

## 1. Start the app
- Use the project's dev command (`docs/context/CONVENTIONS.md`). Run long-running servers in the background and wait for the port: `npx wait-on http://localhost:<port>` or a curl loop with a timeout.
- Use test accounts and seed data from the project's fixtures. Never test against production with real users' data.

## 2. Quick manual pass (browser tool)
If the session has a built-in browser or browser automation tool, open the page, click through the flow, read console errors and failed network requests, and take screenshots at phone and desktop widths.

## 3. Scripted check (Playwright)
Use the helper for a fast smoke check of one or more URLs:

```bash
npx -y playwright@1 install chromium        # once per machine
node "${CLAUDE_PLUGIN_ROOT}/skills/webapp-testing/scripts/smoke.mjs" http://localhost:3000 /login /dashboard
```

It loads each path at 375 px and 1280 px, fails on console errors, page errors and failed requests (4xx/5xx), and writes screenshots to `./.webapp-smoke/`.

## 4. Repeatable e2e tests
For flows that matter, add tests to the project's e2e suite (Playwright test runner if none exists):
- Select by role and label (`getByRole('button', { name: 'Save' })`), not CSS chains.
- Assert on what the user sees (text, URL, enabled state), never on timing; use auto-waiting assertions instead of sleeps.
- Each test creates its own data and cleans up; tests run in any order.
- Cover the happy path, one validation error, one permission case, and the bug you are fixing.

## 5. Report
Flows run, pass/fail per flow, console and network errors, screenshots paths, and anything not covered (for example real payments, emails, native mobile).
