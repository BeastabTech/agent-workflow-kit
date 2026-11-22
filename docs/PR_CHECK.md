# PR check

A reusable GitHub Actions workflow. Any repository can call it to get a secret scan and a short AI review on every pull request, using its own model and its own API key. The project does not need the rest of the kit installed.

## Use it

Add one file to your repository, for example `.github/workflows/pr-check.yml`:

```yaml
name: pr check
on:
  pull_request:
    types: [opened, reopened, synchronize, ready_for_review]

jobs:
  check:
    permissions:
      contents: read
      pull-requests: write
    uses: BeastabTech/agent-workflow-kit/.github/workflows/pr-check.yml@v0.4.0
    with:
      model: <your model id>
      security: true
    secrets:
      api-key: ${{ secrets.ANTHROPIC_API_KEY }}
```

Then add the key under Settings, Secrets and variables, Actions in your repository (or your organisation). Pin `@v0.4.0` to the release tag you want or, stricter, a full commit sha.

Only the secret scan, no model and no key:

```yaml
    uses: BeastabTech/agent-workflow-kit/.github/workflows/pr-check.yml@v0.4.0
    with:
      review: false
```

## Switches

| Input | Default | Meaning |
|---|---|---|
| `review` | `true` | Review the diff for correctness bugs |
| `security` | `false` | Also review for security flaws (access control, injection, secrets, unsafe input handling) |
| `secret-scan` | `true` | Scan added lines for committed credentials; no model needed |
| `provider` | `anthropic` | `anthropic`, or `openai` for any OpenAI-compatible chat completions API |
| `model` | none | Model id. Required when `review` or `security` is on |
| `base-url` | provider default | API base URL, for example `https://openrouter.ai/api/v1`. Must be https; http only for localhost |
| `max-comments` | `8` | Most comments one run may post |
| `max-diff-chars` | `200000` | Largest diff sent to the model |
| `fail-on` | `secrets` | When the job fails: `never`, `secrets` (a clear credential was added), `blocking` (any blocking finding) |
| `rules` | none | Extra review rules for your project, plain text |
| `kit-ref` | same commit as the workflow | Kit version whose scripts run |

Secret: `api-key`, the key for your model provider.

### Other providers

```yaml
    with:
      provider: openai
      model: <model id>
      base-url: https://openrouter.ai/api/v1   # leave out for api.openai.com
    secrets:
      api-key: ${{ secrets.OPENROUTER_API_KEY }}
```

A model on a self-hosted runner needs no key: `base-url: http://localhost:11434/v1`.

## What a comment looks like

```
**Blocking** · correctness
A zero or negative amount now triggers a refund of that amount.
Fails when: charge(user, 0) -> refund(user, 0) is called
Fix: Reject amount <= 0 before billing.
```

Rules the check enforces, in the prompt and again in code:

- Two levels only: `Blocking` and `Should fix`. No nits, style notes, praise, or summary of the PR.
- Every finding names a concrete failure and a fix. A finding without a fix is dropped.
- A finding must point at a file in the diff. One whose line is outside the diff is listed in the review body instead.
- No findings: nothing is posted.
- A finding posted on an earlier push is not posted again.
- A secret comment names the kind of secret and never repeats the value.

## How your key and code are kept safe

| Risk | What the workflow does |
|---|---|
| The key leaks to a pull request from a fork | Use `on: pull_request`. GitHub then gives fork PRs no secrets, and the review is skipped for them with a notice; the secret scan still runs. Never switch to `pull_request_target` to "fix" this |
| The pull request's code runs with your token | The PR is never checked out or executed. The diff is read through the GitHub API; only the kit's own scripts run |
| Text in the diff tells the model what to do | The model gets no tools, so it can only answer with text. The answer is parsed as data: file and line must exist in the diff, text is cut to size, `@mentions` are defused |
| The key ends up in logs | The key is passed to one step as an environment variable, masked in the log, sent only to `base-url`, and never part of an error message |
| The key or code travels unencrypted | `base-url` must be https (http only for localhost) and may not contain credentials |
| A caller's input is run as a shell command | Inputs reach the script as environment variables only; no expression is written into a `run:` line |
| The job has more access than it needs | `contents: read` and `pull-requests: write`, nothing else. The checkout does not keep credentials |
| The kit changes under you | Pin `uses:` to a tag or commit sha. The scripts run from that same commit |

Your code does go to the model provider you chose: the diff is sent to `base-url`. Pick a provider whose data terms you accept.

## Limits

- It reads the diff, not the whole repository. A bug that needs code outside the diff to see is missed.
- GitHub does not return diffs over 300 files or 20,000 lines; the check says so and passes.
- Files that do not fit in `max-diff-chars` are left out whole and named in the review.
- Lock files, build output, vendored and generated files are not reviewed or scanned.
- If the model is down or answers without JSON, the job passes with a warning. Only `fail-on` findings fail it.
- A private kit fork must allow access from the calling repository (Settings, Actions, Access).

## Try it locally

```bash
git diff main...HEAD > /tmp/pr.diff
AWK_DIFF_FILE=/tmp/pr.diff AWK_DRY_RUN=1 AWK_MODEL=<model id> AWK_API_KEY=<key> node scripts/pr-check.js
```

`AWK_DRY_RUN=1` prints the review and posts nothing.
