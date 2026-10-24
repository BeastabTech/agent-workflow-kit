---
name: peer-review
description: Review another agent's or developer's finished change read-only and send ranked findings back - blocking issues first with file:line and a concrete fix - then check the fixes. Use when asked to review a branch, PR, diff, worktree or a teammate agent's work, or when a review-request arrives in the message log.
argument-hint: "[branch | PR | paths]"
---

# Peer review

Target: `$ARGUMENTS` (or the `review-request` message's files/branch).

## 1. Get the change, read-only

- Branch: `git diff <base>...<branch>`; worktree: `git -C <path> diff`; PR: `gh pr diff <n>`; paths: `git diff -- <paths>`.
- Read the author's Done report and the brief or bug it answers. The review checks the change against that goal.
- Do not edit the author's files. In shared mode they hold the claim.

## 2. Review

For a big diff, start the `reviewer` agent (and `security-reviewer` for auth, input, secrets, payments) and merge their results. Check:

1. **Goal:** does it do what the brief or bug asked? Anything missing or out of scope?
2. **Breakage:** callers of changed symbols, contracts, removed or renamed public names, flags default off.
3. **Security and data scope.**
4. **Concurrency and edge cases.**
5. **Tests:** do they test behaviour (and fail without the change)? Is the evidence in the Done report real?
6. **Rules:** protected files approved, docs updated, no secrets, commit and staging rules.

Verify each finding by reading the code around it. Drop anything you cannot point to.

## 3. Report

Rank by severity. Each finding: `severity · file:line · what is wrong · concrete failure case · suggested fix`.

- **Blocking:** bugs, data or security risk, broken contract, missing required test.
- **Should fix:** clear quality or maintainability issues.
- **Nit:** optional; keep to a few.

Send it: `node .agents/tools/msg.js post --from <me> --to <author>,manager --type review --topic "<task>" --body "<findings>"` (or the tool-native channel). Verdict last: `approve`, `approve with nits`, or `changes requested`.

## 4. Re-review

Check only the fixes and anything they touch. Two rounds at most; then the manager or human decides.
