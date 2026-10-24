#!/usr/bin/env node
'use strict';
/**
 * Benchmark the editions on real tasks from a project's own git history.
 * A task = a fix commit: the agent starts from its PARENT, gets a plain-language request, and is
 * scored by the tests that commit added or changed (copied in after the agent finishes; it never
 * sees them) plus the project's whole test suite as a regression check.
 *
 * Safety: every run happens in a throwaway `git worktree` under the temp folder, never in your checkout.
 * Only tracked files exist there (no .env, no keys), secrets-like variables are removed from the
 * environment, and the agent may only read, edit, run the test command and read-only git.
 * Nothing is pushed, deployed, migrated or connected to a database.
 *
 * Usage: node scripts/bench-real.js --repo <path> --tasks <tasks.json> [--runs 1] [--model sonnet]
 *        [--base <sha> --fix <sha>   fill @BASE@ and @FIX@ in tasks.json]
 *        [--arms none,lite,low-tokens,auto,normal,best] [--only id1,id2] [--budget 3] [--out file.json]
 *
 * tasks.json: { "links": ["node_modules", "apps/backend/node_modules"],
 *               "allow": ["Bash(npx jest:*)"], "regression": "cd apps/backend && npx jest",
 *               "tasks": [{ "id": "x", "size": "S", "base": "<parent sha>", "fix": "<fix sha>",
 *                           "hidden": ["apps/backend/src/a.spec.ts"], "hiddenCmd": "cd apps/backend && npx jest src/a.spec.ts",
 *                           "prompt": "..." }] }
 */
const { spawnSync, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { sessionStats } = require('./session-stats');
const presets = require('./lib/presets');

const KIT = path.resolve(__dirname, '..');
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const REPO = fs.realpathSync(path.resolve(arg('repo', '.')));
const SPEC = JSON.parse(fs.readFileSync(path.resolve(arg('tasks', 'tasks.json')), 'utf8').split('@BASE@').join(arg('base', '@BASE@')).split('@FIX@').join(arg('fix', '@FIX@')));
const RUNS = Number(arg('runs', 1));
const MODEL = arg('model', 'sonnet');
const ARMS = arg('arms', 'none,lite,low-tokens,auto,normal,best').split(',');
const ONLY = arg('only', '') ? arg('only', '').split(',') : null;
const BUDGET = arg('budget', '3');
const OUT = arg('out', '');
const PLUGIN_ARMS = new Set(['auto', 'normal', 'best']);
const TOOLS = ['Read', 'Edit', 'Write', 'Glob', 'Grep', 'Bash(cd:*)', 'Bash(ls:*)', 'Bash(git status:*)', 'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git grep:*)', 'Bash(git ls-files:*)', ...(SPEC.allow || [])];

const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

function cleanEnv(extra) {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (/^(ANTHROPIC|CLAUDE)/.test(k) || !/(KEY|TOKEN|SECRET|PASSWORD|DATABASE|REDIS|_URL|CREDENTIAL|AWS_|GOOGLE_|GCP|STRIPE|SUPABASE)/i.test(k)) env[k] = v;
  }
  delete env.AWK_PRESET;
  return { ...env, ...extra };
}

function sessionFile(dir, id) {
  const base = path.join(os.homedir(), '.claude', 'projects');
  const slug = dir.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const d = fs.readdirSync(base).find((x) => x.toLowerCase() === slug);
  return d ? path.join(base, d, `${id}.jsonl`) : null;
}

function jestCounts(out) {
  const nt = /(?:ℹ|#) tests (\d+)[\s\S]*?(?:ℹ|#) pass (\d+)[\s\S]*?(?:ℹ|#) fail (\d+)/.exec(out);
  if (nt) return { failed: Number(nt[3]), passed: Number(nt[2]), total: Number(nt[1]) };
  const m = /Tests:\s+(?:(\d+) failed, )?(?:(\d+) skipped, )?(?:(\d+) passed, )?(\d+) total/.exec(out);
  return m ? { failed: Number(m[1] || 0), passed: Number(m[3] || 0), total: Number(m[4]) } : { failed: 0, passed: 0, total: 0, error: true };
}

function run(task, arm, i) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `awk-real-${task.id}-${arm}-`)));
  const tag = task.project || SPEC.project || 'project';
  fs.rmSync(dir, { recursive: true, force: true });
  git(REPO, 'worktree', 'add', '-q', '--detach', dir, task.base);
  try {
    for (const l of SPEC.links || []) {
      fs.mkdirSync(path.dirname(path.join(dir, l)), { recursive: true });
      if (fs.existsSync(path.join(REPO, l))) fs.symlinkSync(path.join(REPO, l), path.join(dir, l));
    }
    if (presets.NAMES.includes(arm)) {
      execFileSync('node', [path.join(KIT, 'scripts', 'init-project.js'), '--target', dir, '--preset', arm, '--tools', 'claude'], { stdio: 'ignore' });
    }
    const plugin = PLUGIN_ARMS.has(arm);
    const args = ['-p', task.prompt, '--model', MODEL, '--max-turns', '80', '--max-budget-usd', String(BUDGET), '--output-format', 'json', '--allowed-tools', TOOLS.concat(plugin ? ['Agent', 'Skill'] : []).join(','), '--permission-mode', 'acceptEdits'];
    if (plugin) args.push('--plugin-dir', KIT);
    else args.push('--disallowed-tools', 'Agent,Task');
    const t0 = Date.now();
    const r = spawnSync('claude', args, { cwd: dir, encoding: 'utf8', env: cleanEnv(plugin ? { AWK_PRESET: arm } : {}), maxBuffer: 128 * 1024 * 1024, timeout: 25 * 60 * 1000 });
    const secs = Math.round((Date.now() - t0) / 1000);
    let j = {};
    try {
      j = JSON.parse(r.stdout);
    } catch (_) {}
    const file = j.session_id ? sessionFile(dir, j.session_id) : null;
    const s = file && fs.existsSync(file) ? sessionStats(file) : null;
    const changed = git(dir, 'status', '--porcelain').split('\n').filter((l) => l && !/node_modules/.test(l));
    const added = git(dir, 'diff', '--shortstat');
    for (const h of task.hidden) {
      fs.mkdirSync(path.dirname(path.join(dir, h)), { recursive: true });
      fs.writeFileSync(path.join(dir, h), git(REPO, 'show', `${task.fix}:${h}`));
    }
    const sh = (cmd) => spawnSync(cmd, { cwd: dir, shell: true, encoding: 'utf8', env: cleanEnv({ CI: 'true' }), maxBuffer: 64 * 1024 * 1024 });
    const hr = sh(task.hiddenCmd);
    const hid = jestCounts(`${hr.stderr}\n${hr.stdout}`.replace(/\u001b\[[0-9;]*m/g, ''));
    const reg = SPEC.regression ? sh(SPEC.regression) : null;
    const regC = reg ? jestCounts(`${reg.stderr}\n${reg.stdout}`.replace(/\u001b\[[0-9;]*m/g, '')) : null;
    return {
      task: task.id, size: task.size, project: tag, arm, run: i, secs, cost: Number((j.total_cost_usd || 0).toFixed(3)), turns: j.num_turns || null,
      hiddenPassed: hid.passed, hiddenTotal: hid.total, hiddenOk: hid.total > 0 && hid.failed === 0,
      regressionFailed: regC ? regC.failed + (regC.error ? 1 : 0) : null, filesChanged: changed.length, diff: added.trim(),
      freshTotal: s && s.freshTotal, outTok: s && s.main.output + s.sub.output, cacheRead: s && s.main.cacheRead + s.sub.cacheRead, turnsTotal: s && s.main.turns + s.sub.turns, peak: s && s.main.peakContext, subagents: s && s.sub.count, error: j.is_error || r.status !== 0 ? String(j.result || r.stderr || '').slice(0, 160) : undefined,
    };
  } finally {
    try {
      git(REPO, 'worktree', 'remove', '--force', dir);
    } catch (_) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    try {
      git(REPO, 'worktree', 'prune');
    } catch (_) {}
  }
}

const rows = [];
for (let i = 1; i <= RUNS; i++) {
  for (const task of SPEC.tasks.filter((t) => !ONLY || ONLY.includes(t.id))) {
    for (const arm of ARMS) {
      const row = run(task, arm, i);
      rows.push(row);
      process.stderr.write(`${task.id} ${arm} #${i}: hidden ${row.hiddenPassed}/${row.hiddenTotal}${row.hiddenOk ? ' OK' : ''}, regress-fail ${row.regressionFailed}, ${row.secs}s, $${row.cost}${row.error ? ' ERR ' + row.error : ''}\n`);
      if (OUT) fs.writeFileSync(OUT, JSON.stringify({ model: MODEL, rows }, null, 2));
    }
  }
}
process.stdout.write(JSON.stringify({ model: MODEL, runs: RUNS, rows }, null, 2) + '\n');
