#!/usr/bin/env node
'use strict';
/**
 * PR check: reviews a pull request diff with the caller's own model and posts short, concrete
 * comments. Run by .github/workflows/pr-check.yml (a reusable workflow); see docs/PR_CHECK.md.
 *
 * What it does, in order:
 *   1. Reads the PR diff from the GitHub API. The PR's code is never checked out or executed.
 *   2. Secret scan on the added lines (no model, no key needed).
 *   3. If review or security is on and a key is present: one request to the model with the diff.
 *      The model has no tools; its answer is parsed as data (scripts/lib/pr-review.js).
 *   4. Posts one review with inline comments, skipping findings a previous run already posted.
 *      No findings: posts nothing.
 *   5. Exit code 1 only when fail-on says so (secrets, or any blocking finding).
 *
 * Settings come from environment variables only (the workflow maps its inputs to them), so no
 * caller-controlled text is ever pasted into a shell command:
 *   AWK_REVIEW, AWK_SECURITY, AWK_SECRET_SCAN   true | false
 *   AWK_PROVIDER    anthropic | openai (any OpenAI-compatible chat completions API)
 *   AWK_MODEL       model id (required for review or security)
 *   AWK_API_KEY     the caller's key; only this process sees it and it is never printed
 *   AWK_BASE_URL    API base URL; https only, except localhost for a model on the runner
 *   AWK_MAX_COMMENTS (8), AWK_MAX_DIFF_CHARS (200000), AWK_FAIL_ON never | secrets | blocking
 *   AWK_RULES       extra review rules from the caller's workflow file
 *   AWK_DRY_RUN=1   print the review instead of posting; AWK_DIFF_FILE reads the diff from a file
 */
const fs = require('fs');
const R = require('./lib/pr-review');

const env = process.env;
const on = (v, fallback) => (v === undefined || v === '' ? fallback : /^(true|1|yes|on)$/i.test(String(v).trim()));
const num = (v, fallback, min, max) => (Number.isFinite(Number(v)) && String(v).trim() !== '' ? Math.min(max, Math.max(min, Math.floor(Number(v)))) : fallback);
const log = (s) => process.stdout.write(`${s}\n`);
/** GitHub annotations: shown on the run page. Newlines would break the command, so flatten them. */
const notice = (s) => log(`::notice title=PR check::${String(s).replace(/\r?\n/g, ' ')}`);
const warning = (s) => log(`::warning title=PR check::${String(s).replace(/\r?\n/g, ' ')}`);

const DEFAULT_BASE = { anthropic: 'https://api.anthropic.com', openai: 'https://api.openai.com/v1' };
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

/** The base URL must be https so the key and the code never travel in clear text; localhost is allowed for a model running on the runner itself. */
function baseUrl(provider, given) {
  const raw = String(given || DEFAULT_BASE[provider] || '').trim().replace(/\/+$/, '');
  let u;
  try {
    u = new URL(raw);
  } catch (_) {
    throw new Error('base-url is not a valid URL');
  }
  const local = LOCAL_HOSTS.includes(u.hostname);
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) throw new Error('base-url must be https (http is allowed only for localhost)');
  if (u.username || u.password) throw new Error('base-url must not contain credentials; pass the key as the api-key secret');
  return raw;
}

/** True when the base URL is a model on the runner itself, which needs no key. */
function isLocal(url) {
  try {
    return LOCAL_HOSTS.includes(new URL(String(url)).hostname);
  } catch (_) {
    return false;
  }
}

/** fetch with a time limit and one retry on rate limit, server error or network error. Error text never includes request headers. */
async function http(url, init, label) {
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(url, { ...init, signal: AbortSignal.timeout(180000) });
    } catch (e) {
      if (attempt < 1) continue;
      throw new Error(`${label}: request failed (${e.name === 'TimeoutError' ? 'timed out' : 'network error'})`);
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 1) {
      await new Promise((r) => setTimeout(r, Number(env.AWK_RETRY_MS) || 4000));
      continue;
    }
    const text = await res.text();
    if (!res.ok) throw new Error(`${label}: HTTP ${res.status} ${text.slice(0, 300).replace(/\s+/g, ' ')}`);
    return text;
  }
}

/** One request to the model; returns its text answer. No tools are offered, so the answer cannot act on anything. */
async function askModel({ provider, base, model, key, system, user }) {
  if (provider === 'anthropic') {
    const text = await http(
      `${base}/v1/messages`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: 16000, system, messages: [{ role: 'user', content: user }] }),
      },
      'model',
    );
    const msg = JSON.parse(text);
    if (msg.stop_reason === 'refusal') throw new Error('model: the model declined to review this diff');
    if (msg.stop_reason === 'max_tokens') throw new Error('model: the answer was cut off (max_tokens)');
    return (msg.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  }
  if (provider === 'openai') {
    const text = await http(
      `${base}/chat/completions`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}) },
        body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
      },
      'model',
    );
    const msg = JSON.parse(text);
    const c = msg.choices && msg.choices[0] && msg.choices[0].message && msg.choices[0].message.content;
    return typeof c === 'string' ? c : Array.isArray(c) ? c.map((p) => p.text || '').join('') : '';
  }
  throw new Error(`provider must be "anthropic" or "openai", got "${provider}"`);
}

function github(token) {
  const api = (env.GITHUB_API_URL || 'https://api.github.com').replace(/\/+$/, '');
  const call = (method, path, body, accept) =>
    http(
      `${api}${path}`,
      {
        method,
        headers: { authorization: `Bearer ${token}`, accept: accept || 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'agent-workflow-kit-pr-check', ...(body ? { 'content-type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      },
      'github',
    );
  return { call };
}

/** Bodies of this PR's existing review comments and reviews (up to 300 of each), to find what was already posted. */
async function existingBodies(gh, repo, pr) {
  const bodies = [];
  for (const kind of ['comments', 'reviews']) {
    for (let page = 1; page <= 3; page++) {
      const list = JSON.parse(await gh.call('GET', `/repos/${repo}/pulls/${pr}/${kind}?per_page=100&page=${page}`));
      for (const c of list) bodies.push(c.body);
      if (list.length < 100) break;
    }
  }
  return bodies;
}

async function main() {
  const cfg = {
    review: on(env.AWK_REVIEW, true),
    security: on(env.AWK_SECURITY, false),
    secretScan: on(env.AWK_SECRET_SCAN, true),
    provider: String(env.AWK_PROVIDER || 'anthropic').trim().toLowerCase(),
    model: String(env.AWK_MODEL || '').trim(),
    key: String(env.AWK_API_KEY || '').trim(),
    maxComments: num(env.AWK_MAX_COMMENTS, 8, 1, 30),
    maxDiffChars: num(env.AWK_MAX_DIFF_CHARS, 200000, 2000, 2000000),
    failOn: String(env.AWK_FAIL_ON || 'secrets').trim().toLowerCase(),
    rules: env.AWK_RULES || '',
    dry: on(env.AWK_DRY_RUN, false),
  };
  if (cfg.key) log(`::add-mask::${cfg.key}`); // if anything ever echoes the key, the runner prints *** instead
  if (!['never', 'secrets', 'blocking'].includes(cfg.failOn)) throw new Error('fail-on must be never, secrets or blocking');

  const event = env.GITHUB_EVENT_PATH ? JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH, 'utf8')) : {};
  const pull = event.pull_request || {};
  const repo = env.GITHUB_REPOSITORY || '';
  const gh = github(env.GITHUB_TOKEN || '');
  if (!env.AWK_DIFF_FILE && (!pull.number || !repo)) {
    notice('Not a pull_request event: nothing to check.');
    return 0;
  }

  let diff;
  try {
    diff = env.AWK_DIFF_FILE ? fs.readFileSync(env.AWK_DIFF_FILE, 'utf8') : await gh.call('GET', `/repos/${repo}/pulls/${pull.number}`, null, 'application/vnd.github.diff');
  } catch (e) {
    warning(`Could not read the diff (${e.message}). GitHub refuses diffs over 300 files or 20,000 lines; split the PR. Nothing was checked.`);
    return 0;
  }
  const files = R.parseDiff(diff);
  const notes = [];
  let findings = [];
  let secrets = [];

  if (cfg.secretScan) secrets = R.secretFindings(files);

  if (cfg.review || cfg.security) {
    const rendered = R.renderDiff(files, cfg.maxDiffChars);
    if (rendered.dropped.length) notes.push(`Not reviewed, diff too large: ${rendered.dropped.slice(0, 8).join(', ')}${rendered.dropped.length > 8 ? ` and ${rendered.dropped.length - 8} more` : ''}.`);
    if (!cfg.key && !isLocal(env.AWK_BASE_URL)) {
      // Fork PRs get no secrets from GitHub. That is the safe default; do not work around it with pull_request_target.
      notice('No api-key available (a PR from a fork gets no secrets, or the secret is not set): the model review was skipped. The secret scan still ran.');
    } else if (!cfg.model) {
      warning('The model input is empty: the model review was skipped. Set `model` in the workflow that calls pr-check.');
    } else if (!rendered.text) {
      notice('No reviewable changes in this diff (only lock files, generated files or deletions).');
    } else {
      try {
        const answer = await askModel({ provider: cfg.provider, base: baseUrl(cfg.provider, env.AWK_BASE_URL), model: cfg.model, key: cfg.key, system: R.buildSystem(cfg), user: R.buildUser({ title: pull.title, diffText: rendered.text }) });
        const raw = R.parseFindings(answer);
        if (raw === null) warning('The model did not answer with the expected JSON; no review comments were posted.');
        else findings = R.cleanFindings(raw, files, cfg.maxComments);
      } catch (e) {
        // A model outage must not block merges: report it and go on with what the secret scan found.
        warning(`Model review failed: ${e.message}`);
      }
    }
  }

  const all = [...secrets, ...findings];
  let fresh = all;
  if (!cfg.dry && all.length) {
    try {
      const posted = R.postedKeys(await existingBodies(gh, repo, pull.number));
      fresh = all.filter((f) => !posted.has(f.key));
    } catch (_) {} // cannot read old comments: post everything rather than nothing
  }

  const inline = fresh.filter((f) => f.line !== null).map((f) => ({ path: f.path, line: f.line, side: 'RIGHT', body: R.formatComment(f) }));
  const body = R.formatBody(fresh, notes);
  if (cfg.dry) {
    log(body || 'PR check: no findings.');
    for (const c of inline) log(`\n${c.path}:${c.line}\n${c.body}`);
  } else if (fresh.length) {
    const review = { commit_id: pull.head && pull.head.sha, event: 'COMMENT', body };
    try {
      await gh.call('POST', `/repos/${repo}/pulls/${pull.number}/reviews`, { ...review, comments: inline });
    } catch (e) {
      // One bad line number rejects the whole review. Fall back to a single body so findings are not lost.
      try {
        await gh.call('POST', `/repos/${repo}/pulls/${pull.number}/reviews`, { ...review, body: [body, ...inline.map((c) => `- \`${c.path}:${c.line}\` ${c.body.replace(/\n/g, ' ')}`)].join('\n') });
      } catch (e2) {
        warning(`Could not post the review (${e2.message}). The calling workflow needs "pull-requests: write".`);
      }
    }
  }

  const count = (s) => all.filter((f) => f.severity === s).length;
  const line = `${count('blocking')} blocking, ${count('should-fix')} should fix (${secrets.length} from the secret scan); ${fresh.length} new comment(s).`;
  log(`PR check: ${line}`);
  if (env.GITHUB_STEP_SUMMARY) {
    try {
      fs.appendFileSync(env.GITHUB_STEP_SUMMARY, `### PR check\n${line}\n${notes.map((n) => `- ${n}`).join('\n')}\n`);
    } catch (_) {}
  }
  const blockingSecret = secrets.some((f) => f.severity === 'blocking');
  if (cfg.failOn === 'secrets' && blockingSecret) return 1;
  if (cfg.failOn === 'blocking' && count('blocking') > 0) return 1;
  return 0;
}

if (require.main === module) {
  main().then(
    (code) => process.exit(code),
    (e) => {
      process.stdout.write(`::error title=PR check::${String(e.message).replace(/\r?\n/g, ' ')}\n`);
      process.exit(1);
    },
  );
}

module.exports = { baseUrl, isLocal };
