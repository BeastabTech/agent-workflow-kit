#!/usr/bin/env node
'use strict';
/**
 * Benchmark the editions on one task: add coupons to a tiny cart module (benchmarks/fixtures/cart).
 * Every run starts from the same fresh repo. Quality = how many of 8 HIDDEN acceptance tests pass
 * (the agent never sees them). Cost, tokens and time come from the session transcript.
 * It spends real tokens: 5 arms x runs x roughly 0.1-0.5 USD.
 *
 * Usage: node scripts/bench-presets.js [--runs 1] [--model sonnet] [--arms none,lite,low-tokens,normal,best]
 *        [--task coupons] [--keep]
 * Arm "none" = no kit at all. lite and low-tokens use the project files only (no plugin);
 * normal and best load this kit as a plugin and have init run.
 */
const { spawnSync, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { sessionStats } = require('./session-stats');
const presets = require('./lib/presets');

const KIT = path.resolve(__dirname, '..');
const FIXTURE = path.join(KIT, 'benchmarks', 'fixtures');
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const RUNS = Number(arg('runs', 1));
const MODEL = arg('model', 'sonnet');
const ARMS = arg('arms', 'none,lite,low-tokens,normal,best').split(',');
const KEEP = process.argv.includes('--keep');
const TASK =
  'In lib/cart.js add coupon support: applyCoupon(cart, coupon, now) where a coupon is { code, type: "percent"|"fixed", value, expires? }. ' +
  'The coupon reduces total(cart). Make it work properly for a real shop. Run the tests when you are done and tell me briefly what you did.';
const TOOLS = 'Read,Edit,Write,Glob,Grep,Bash(node:*),Bash(npm:*),Bash(git status:*),Bash(git diff:*),Bash(git ls-files:*),Bash(git grep:*)';

function sessionFile(dir, id) {
  const base = path.join(os.homedir(), '.claude', 'projects');
  const slug = dir.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const d = fs.readdirSync(base).find((x) => x.toLowerCase() === slug);
  return d ? path.join(base, d, `${id}.jsonl`) : null;
}

function freshRepo(arm) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `awk-bench-${arm}-`)));
  fs.cpSync(path.join(FIXTURE, 'cart'), dir, { recursive: true });
  const g = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'ignore' });
  g('init', '-q', '-b', 'work');
  g('config', 'user.email', 'bench@example.com');
  g('config', 'user.name', 'bench');
  if (presets.NAMES.includes(arm)) {
    execFileSync('node', [path.join(KIT, 'scripts', 'init-project.js'), '--target', dir, '--preset', arm, '--tools', 'claude'], { stdio: 'ignore' });
    fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules/\n.agents/LOG.md\n.agents/.budget/\n');
  }
  g('add', '-A');
  g('commit', '-q', '-m', 'chore: fixture');
  return dir;
}

function hiddenScore(dir) {
  const t = path.join(dir, 'test', 'zz-hidden.test.js');
  fs.writeFileSync(t, fs.readFileSync(path.join(FIXTURE, 'cart-hidden.test.js'), 'utf8').replace('./cart/lib/cart', '../lib/cart'));
  const r = spawnSync('node', ['--test', t], { cwd: dir, encoding: 'utf8' });
  const m = /# pass (\d+)/.exec(r.stdout) || /ℹ pass (\d+)/.exec(r.stdout);
  fs.rmSync(t, { force: true });
  return m ? Number(m[1]) : 0;
}

function ownTests(dir) {
  let n = 0;
  for (const f of fs.readdirSync(path.join(dir, 'test'))) n += (fs.readFileSync(path.join(dir, 'test', f), 'utf8').match(/\btest\(/g) || []).length;
  return n;
}

const rows = [];
for (let i = 1; i <= RUNS; i++) {
  for (const arm of ARMS) {
    const dir = freshRepo(arm);
    const plugin = arm === 'normal' || arm === 'best';
    const args = ['-p', TASK, '--model', MODEL, '--max-turns', '40', '--output-format', 'json', '--allowed-tools', TOOLS + (plugin ? ',Agent,Skill' : ''), '--permission-mode', 'acceptEdits'];
    if (plugin) args.push('--plugin-dir', KIT);
    else args.push('--disallowed-tools', 'Agent,Task');
    const env = { ...process.env };
    delete env.AWK_PRESET;
    if (plugin) env.AWK_PRESET = arm;
    const t0 = Date.now();
    const r = spawnSync('claude', args, { cwd: dir, encoding: 'utf8', env, maxBuffer: 64 * 1024 * 1024 });
    let j = {};
    try {
      j = JSON.parse(r.stdout);
    } catch (_) {}
    const file = j.session_id ? sessionFile(dir, j.session_id) : null;
    const s = file && fs.existsSync(file) ? sessionStats(file) : null;
    const row = {
      run: i, arm, secs: Math.round((Date.now() - t0) / 1000), cost: Number((j.total_cost_usd || 0).toFixed(3)),
      hidden: hiddenScore(dir), ownTests: ownTests(dir),
      freshTotal: s && s.freshTotal, peak: s && s.main.peakContext, subagents: s && s.sub.count, turns: j.num_turns || (s && s.main.turns),
    };
    rows.push(row);
    process.stderr.write(`${arm} run ${i}: hidden ${row.hidden}/8, ${row.secs}s, $${row.cost}\n`);
    if (!KEEP) fs.rmSync(dir, { recursive: true, force: true });
  }
}
const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const median = {};
for (const arm of ARMS) {
  const g = rows.filter((x) => x.arm === arm);
  median[arm] = Object.fromEntries(['hidden', 'ownTests', 'freshTotal', 'peak', 'secs', 'cost', 'subagents'].map((k) => [k, med(g.map((x) => x[k] || 0))]));
}
process.stdout.write(JSON.stringify({ task: 'coupons', model: MODEL, runs: RUNS, rows, median }, null, 2) + '\n');
