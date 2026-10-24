---
name: tdd
description: Test-driven development loop - write a failing test for the behaviour, make it pass with the smallest change, refactor while green, and cover edge cases. Use when building new logic, fixing a bug, or when the user asks for TDD, tests first, or better test coverage.
---

# TDD loop

## Cycle
1. **Red:** write one test for one behaviour, named for the behaviour (`returns 404 when the item belongs to another user`). Run it; it must fail for the right reason. Paste the failure line.
2. **Green:** the smallest code change that passes. No extra features.
3. **Refactor:** clean up names and duplication with all tests green. Run the area's tests again.
4. Repeat for the next behaviour.

## What to test
- Behaviour through the public interface, not private details.
- The edge-case list in `docs/context/TESTING.md`: access, validation, idempotency, external failure, state transitions, time and money.
- Bugs: a regression test that fails before the fix.

## Rules
- Fake external services (payments, email, third-party APIs). Never hit real ones.
- Tests are deterministic: fixed clocks and seeds, no order dependence, no sleeps for timing.
- Keep test data obviously fake (`TEST_`, `example.com`).
- Coverage is a hint, not the goal; scope coverage runs to the code you changed.
- A test that never failed proves nothing: break the code once and watch it fail.
