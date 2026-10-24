#!/usr/bin/env node
'use strict';
/**
 * Micro-benchmark: the same read-only search task with and without a sub-agent, N runs per arm,
 * measured from the session transcripts (see docs/BENCHMARK.md). It spends real tokens.
 *
 * Usage: node scripts/bench-delegation.js --repo <dir> [--runs 3] [--model sonnet]
 * Arm A: no plugin, Agent tool disabled. Arm B: this kit as a plugin, the search goes to the explorer agent.
 * Score = how many of the MUST files appear in the answer (edit MUST for your repo).
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { sessionStats } = require('./session-stats');

const KIT = path.resolve(__dirname, '..');
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const REPO = fs.realpathSync(path.resolve(arg('repo', '.')));
const RUNS = Number(arg('runs', 3));
const MODEL = arg('model', 'sonnet');
const TASK = 'Find every place in this repo where the sub-agent spawn limits (limits.maxParallel, maxSpawns, tokenBudget and friends) are defined, read, enforced, configured, documented or tested. Return a table of file path and one line on what that file does with the limits. Under 30 lines. Read-only: do not edit anything.';
const EXTRA = ' Use the explorer sub-agent (Agent tool, subagent_type explorer) to do the searching, ask it for file:line pointers only, and read only its report; do not read the files yourself beyond a quick check.';
const TOOLS = 'Read,Grep,Glob,Bash(git grep:*),Bash(git ls-files:*)';
const MUST = ['scripts/lib/budget.js', 'scripts/hooks/pre-agent.js', 'scripts/agent-budget.js', 'scripts/init-project.js', 'scripts/hooks/session-start.js', 'docs/CONFIG.md', 'docs/HOOKS.md', 'tests/budget.test.js'];

function sessionFile(id) {
  const base = path.join(os.homedir(), '.claude', 'projects');
  const slug = REPO.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const dir = fs.readdirSync(base).find((d) => d.toLowerCase() === slug);
  return dir ? path.join(base, dir, `${id}.jsonl`) : null;
}

const rows = [];
for (let i = 1; i <= RUNS; i++) {
  for (const arm of ['A-baseline', 'B-kit']) {
    const a = ['-p', arm === 'A-baseline' ? TASK : TASK + EXTRA, '--model', MODEL, '--max-turns', '40', '--output-format', 'json'];
    if (arm === 'A-baseline') a.push('--allowed-tools', TOOLS, '--disallowed-tools', 'Agent,Task');
    else a.push('--allowed-tools', `${TOOLS},Agent`, '--plugin-dir', KIT);
    const t0 = Date.now();
    const r = spawnSync('claude', a, { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    let j = {};
    try {
      j = JSON.parse(r.stdout);
    } catch (_) {}
    const text = String(j.result || '');
    const file = j.session_id ? sessionFile(j.session_id) : null;
    const s = file && fs.existsSync(file) ? sessionStats(file) : null;
    rows.push({
      run: i, arm, secs: Math.round((Date.now() - t0) / 1000), cost: j.total_cost_usd || 0,
      score: MUST.filter((f) => text.includes(f)).length,
      mainPeak: s && s.main.peakContext, freshMain: s && s.freshMain, freshSub: s && s.freshSub, freshTotal: s && s.freshTotal, subagents: s && s.sub.count,
    });
    process.stderr.write(`${arm} run ${i}: ${rows[rows.length - 1].secs}s\n`);
  }
}
const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const out = { model: MODEL, runs: RUNS, rows, median: {} };
for (const arm of ['A-baseline', 'B-kit']) {
  const g = rows.filter((x) => x.arm === arm);
  out.median[arm] = Object.fromEntries(['secs', 'cost', 'score', 'mainPeak', 'freshMain', 'freshSub', 'freshTotal'].map((k) => [k, med(g.map((x) => x[k] || 0))]));
}
process.stdout.write(JSON.stringify(out, null, 2) + '\n');
