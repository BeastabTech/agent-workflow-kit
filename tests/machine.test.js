'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { ROOT, tmpRepo, runHook, decision } = require('./helpers');
const B = require('../scripts/lib/budget');
const R = require('../scripts/lib/resources');

const limits = { ...B.DEFAULT_LIMITS };
const box = (o) => ({ cores: 8, load1: 1, totalMB: 16384, availMB: 10000, agentProcs: 1, agentRssMB: 500, ...o });
const reason = (r) => (r.json && r.json.hookSpecificOutput && (r.json.hookSpecificOutput.permissionDecisionReason || r.json.hookSpecificOutput.additionalContext)) || '';

test('safeParallel: memory, CPU and the limit each cap the count', () => {
  // reserve = max(2048, 15% of 16384 = 2458) = 2458; (10000 - 2458) / 600 = 12 slots; idle cores 7; limit 4
  assert.deepEqual([R.safeParallel(box(), limits).parallel, R.safeParallel(box(), limits).limitedBy], [4, 'limit']);
  const mem = R.safeParallel(box({ availMB: 4000 }), limits); // (4000 - 2458) / 600 = 2
  assert.equal(mem.parallel, 2);
  assert.equal(mem.limitedBy, 'memory');
  const cpu = R.safeParallel(box({ load1: 5.5 }), limits); // idle 2.5 cores
  assert.equal(cpu.parallel, 2);
  assert.equal(cpu.limitedBy, 'cpu');
  assert.equal(R.safeParallel(box({ load1: 0 }), { ...limits, maxParallel: 0 }).parallel, 12); // Windows: no load reading, memory decides
});

test('safeParallel: pressure high when memory or CPU is used up, and the text says so', () => {
  const low = R.safeParallel(box({ availMB: 2000 }), limits);
  assert.equal(low.pressure, 'high');
  assert.equal(low.parallel, 1);
  assert.match(R.describe(box({ availMB: 2000 }), low), /Pressure HIGH/);
  assert.equal(R.safeParallel(box({ load1: 8.2 }), limits).pressure, 'high');
  assert.equal(R.safeParallel(box({ availMB: 3300 }), limits).pressure, 'medium'); // one slot left
  assert.match(R.describe(box({ agentProcs: 5, agentRssMB: 3000 }), R.safeParallel(box({ agentProcs: 5 }), limits)), /5 agent process/);
});

test('real snapshot reads this machine without throwing', () => {
  const s = R.snapshot();
  assert.ok(s.cores >= 1 && s.totalMB > 0 && s.availMB >= 0 && s.agentProcs >= 0);
});

test('machine: off by limit or AWK_MACHINE=off, faked by JSON', () => {
  const saved = process.env.AWK_MACHINE;
  try {
    process.env.AWK_MACHINE = 'off';
    assert.equal(B.machine(limits), null);
    process.env.AWK_MACHINE = JSON.stringify(box({ availMB: 4000 }));
    assert.equal(B.machine(limits).fit.parallel, 2);
    assert.equal(B.machine({ ...limits, machineCheck: 0 }), null);
  } finally {
    process.env.AWK_MACHINE = saved;
  }
});

test('plan: warns when parallel is over what the machine can take, or under pressure', () => {
  const m = { fit: R.safeParallel(box({ availMB: 4000 }), limits), text: '' };
  assert.match(B.plan(limits, { agents: 4, parallel: 4, machine: m }).warnings.join(' '), /more than this machine can take now \(2/);
  assert.equal(B.plan(limits, { agents: 2, parallel: 2, machine: m }).warnings.length, 0);
  const hot = { fit: R.safeParallel(box({ availMB: 1000 }), limits), text: '' };
  assert.match(B.plan(limits, { agents: 1, parallel: 1, machine: hot }).warnings.join(' '), /under pressure/);
});

test('budget.js machine prints the safe count; plan prints the machine line', () => {
  const env = { ...process.env, AWK_MACHINE: JSON.stringify(box({ availMB: 4000 })) };
  const run = (...a) => spawnSync('node', [path.join(ROOT, 'scripts', 'agent-budget.js'), ...a], { encoding: 'utf8', env });
  assert.match(run('machine').stdout, /Safe to run 2 agent\(s\) at once \(limited by memory\)/);
  assert.match(run('plan', '--agents', '4', '--parallel', '4').stdout, /Machine: .*\nWARNING: .*parallel limit|WARNING: 4 at once is more than this machine/);
  assert.match(spawnSync('node', [path.join(ROOT, 'scripts', 'agent-budget.js'), 'machine'], { encoding: 'utf8', env: { ...process.env, AWK_MACHINE: 'off' } }).stdout, /off/);
});

const spawn = (dir, session, type, env) => runHook('pre-agent', { session_id: session, cwd: dir, tool_input: { description: 'd', prompt: 'p' + Math.random(), subagent_type: type } }, env);

test('pre-agent hook: asks when a spawn goes over what the machine can run at once', () => {
  const { dir } = tmpRepo({ planGate: false, limits: { smallRepoFiles: 0, maxParallel: 10, maxSpawns: 50 } });
  const env = { AWK_MACHINE: JSON.stringify(box({ availMB: 4000 })) }; // 2 at once
  assert.equal(decision(spawn(dir, 's', 'reviewer', env)), 'allow');
  assert.equal(decision(spawn(dir, 's', 'reviewer', env)), 'allow');
  const third = spawn(dir, 's', 'reviewer', env);
  assert.equal(decision(third), 'ask');
  assert.match(reason(third), /machine-check.*agent 3 running at once; this machine can take 2/);
  assert.equal(decision(spawn(dir, 's', 'reviewer', { AWK_MACHINE: 'off' })), 'allow');
});

test('pre-agent hook: under high pressure the first agent warns, a second asks', () => {
  const { dir } = tmpRepo({ planGate: false, limits: { smallRepoFiles: 0 } });
  const env = { AWK_MACHINE: JSON.stringify(box({ availMB: 1500 })) };
  const first = spawn(dir, 'h', 'reviewer', env);
  assert.equal(decision(first), 'warn');
  assert.match(reason(first), /Pressure HIGH/);
  assert.equal(decision(spawn(dir, 'h', 'reviewer', env)), 'ask');
});

test('plan gate: workers ask until PLAN.md is approved; read-only helpers pass', () => {
  const { dir } = tmpRepo({ limits: { smallRepoFiles: 0 } });
  const w = spawn(dir, 'g', 'general-purpose');
  assert.equal(decision(w), 'ask');
  assert.match(reason(w), /plan-gate.*Status: approved/);
  assert.equal(decision(spawn(dir, 'g1', 'explorer')), 'allow');
  assert.equal(decision(spawn(dir, 'g2', 'agent-workflow-kit:planner')), 'allow');
  assert.equal(decision(spawn(dir, 'g3', 'Explore')), 'allow');
  fs.writeFileSync(path.join(dir, '.agents', 'PLAN.md'), '# Plan\n\nStatus: draft\n');
  assert.equal(decision(spawn(dir, 'g4', 'test-writer')), 'ask');
  fs.writeFileSync(path.join(dir, '.agents', 'PLAN.md'), '# Plan\n\nStatus: approved\nApproved by: "yes, go"\n');
  assert.equal(decision(spawn(dir, 'g5', 'test-writer')), 'allow');
  assert.equal(decision(spawn(dir, 'g6', 'general-purpose', { AWK_PROFILE: 'minimal' })), 'allow');
});

test('plan gate: off outside kit projects, by config and by AWK_DISABLE', () => {
  const { dir: bare } = tmpRepo();
  assert.equal(decision(spawn(bare, 'n', 'general-purpose')), 'allow');
  const { dir: off } = tmpRepo({ planGate: false, limits: { smallRepoFiles: 0 } });
  assert.equal(decision(spawn(off, 'n', 'general-purpose')), 'allow');
  const { dir } = tmpRepo({ limits: { smallRepoFiles: 0 } });
  assert.equal(decision(spawn(dir, 'n', 'general-purpose', { AWK_DISABLE: 'plan-gate' })), 'allow');
});

test('session-start: kit projects get the discover-first note and a machine line', () => {
  const { dir } = tmpRepo({});
  const r = runHook('session-start', { cwd: dir, source: 'startup' });
  const ctx = r.json.hookSpecificOutput.additionalContext;
  assert.match(ctx, /discover skill/);
  assert.match(ctx, /Machine: .* Safe to run/);
});

test('init copies resources.js and PLAN.md, and budget.js machine runs in the project', () => {
  const { init } = require('../scripts/init-project');
  const { dir } = tmpRepo();
  const r = init({ target: dir, tools: 'claude' });
  assert.ok(r.written.includes('.agents/tools/lib/resources.js'));
  assert.match(fs.readFileSync(path.join(dir, '.agents', 'PLAN.md'), 'utf8'), /^Status: draft$/m);
  const out = spawnSync('node', ['.agents/tools/budget.js', 'machine'], { cwd: dir, encoding: 'utf8' });
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /Safe to run|Pressure HIGH/);
});

test('parseAgentPs: CLI sessions count, desktop helpers, wrappers and MCP servers do not', () => {
  const ps = [
    '290928 /opt/app/Library/Application Support/Claude/claude-code/2.1.0/abc/claude.app/Contents/MacOS/claude --resume x',
    '  1200 /Applications/Claude.app/Contents/Helpers/disclaimer --pgroup -- /opt/app/Library/Application Support/Claude/claude-code/2.1.0/abc/claude.app/Contents/MacOS/claude',
    '400000 /Applications/Claude.app/Contents/Frameworks/Claude Helper (Renderer).app/Contents/MacOS/Claude Helper (Renderer) --type=renderer',
    '150000 /opt/homebrew/bin/node /opt/npm/lib/node_modules/@anthropic-ai/claude-code/cli.js',
    ' 90000 /usr/local/bin/node /opt/claude/plugins/some-mcp/server.js',
    ' 80000 codex --full-auto',
    ' 70000 /usr/local/bin/gemini',
    ' 60000 node /usr/lib/node_modules/@google/gemini-cli/dist/index.js',
    ' 50000 ugrep -G claude',
  ].join('\n');
  const r = R.parseAgentPs(ps);
  assert.equal(r.count, 5);
  assert.equal(r.rssMB, Math.round((290928 + 150000 + 80000 + 70000 + 60000) / 1024));
  assert.deepEqual(R.parseAgentPs(''), { count: 0, rssMB: 0 });
});

test('limits as strings and odd limits still give a sane fit', () => {
  const l = B.limitsFrom({ limits: { agentMemMB: '800', memReserveMB: '0', cpuPerAgent: '2', maxParallel: '0' } });
  assert.equal(l.agentMemMB, 800);
  const fit = R.safeParallel(box({ availMB: 6000, load1: 2 }), l); // reserve floor 15% = 2458; (6000-2458)/800 = 4; cpu (8-2)/2 = 3
  assert.equal(fit.parallel, 3);
  assert.equal(fit.limitedBy, 'cpu');
  assert.equal(B.machine(B.limitsFrom({ limits: { machineCheck: '0' } })), null);
});

test('plan gate: CRLF, casing, done status, and read-only names with prefixes or hyphens', () => {
  const { dir } = tmpRepo({ limits: { smallRepoFiles: 0 } });
  const plan = path.join(dir, '.agents', 'PLAN.md');
  fs.writeFileSync(plan, '# Plan\r\n\r\nstatus: APPROVED\r\n');
  assert.equal(decision(spawn(dir, 'c1', 'closer')), 'allow');
  fs.writeFileSync(plan, '# Plan\n\nStatus: done\n');
  assert.equal(decision(spawn(dir, 'c2', 'closer')), 'ask');
  for (const t of ['ecc:code-reviewer', 'ecc:code-explorer', 'ecc:architect', 'Plan', 'claude-code-guide', 'ecc:comment-analyzer']) assert.equal(decision(spawn(dir, 'c3' + t, t)), 'allow', t);
  for (const t of ['test-writer', 'agent-workflow-kit:qa-tester', 'ecc:gan-generator']) assert.equal(decision(spawn(dir, 'c4' + t, t)), 'ask', t);
});

test('plan gate: "false" and 0 in config turn it off; the approved plan in the main checkout counts from a worktree', () => {
  const { dir: a } = tmpRepo({ planGate: 'false', limits: { smallRepoFiles: 0 } });
  assert.equal(decision(spawn(a, 'f', 'general-purpose')), 'allow');
  const { dir: b } = tmpRepo({ planGate: 0, limits: { smallRepoFiles: 0 } });
  assert.equal(decision(spawn(b, 'f', 'general-purpose')), 'allow');
  const { dir, git } = tmpRepo({ limits: { smallRepoFiles: 0 } });
  git('add', '.agents/config.json');
  git('commit', '-q', '-m', 'chore: kit config');
  const wt = path.join(dir, '..', path.basename(dir) + '-wt');
  git('worktree', 'add', '-q', wt, '-b', 'wt');
  assert.equal(decision(spawn(wt, 'w1', 'general-purpose')), 'ask');
  fs.writeFileSync(path.join(dir, '.agents', 'PLAN.md'), 'Status: approved\n');
  assert.equal(decision(spawn(wt, 'w2', 'general-purpose')), 'allow');
  fs.writeFileSync(path.join(dir, '.agents', 'PLAN.md'), 'Status: draft\n');
  fs.mkdirSync(path.join(wt, '.agents'), { recursive: true });
  fs.writeFileSync(path.join(wt, '.agents', 'PLAN.md'), 'Status: approved\n');
  assert.equal(decision(spawn(wt, 'w3', 'general-purpose')), 'allow');
});

test('a spawn that ends in a question is not counted as running', () => {
  const { dir } = tmpRepo({ limits: { smallRepoFiles: 0, maxParallel: 10 } });
  assert.equal(decision(spawn(dir, 'q', 'general-purpose')), 'ask'); // plan gate
  const status = spawnSync('node', [path.join(ROOT, 'scripts', 'agent-budget.js'), 'status', '--session', 'q'], { cwd: dir, encoding: 'utf8' }).stdout;
  assert.match(status, /0 started/);
  assert.equal(decision(spawn(dir, 'q', 'explorer')), 'allow');
  assert.match(spawnSync('node', [path.join(ROOT, 'scripts', 'agent-budget.js'), 'status', '--session', 'q'], { cwd: dir, encoding: 'utf8' }).stdout, /1 started/);
});

test('low-tokens: the parallel cap comes from the budget check alone, not a second machine question', () => {
  const { dir } = tmpRepo({ planGate: false, preset: 'low-tokens', limits: { smallRepoFiles: 0 } });
  assert.equal(decision(spawn(dir, 'lt', 'reviewer')), 'allow');
  const second = spawn(dir, 'lt', 'reviewer');
  assert.equal(decision(second), 'ask');
  assert.match(reason(second), /agent-budget/);
  assert.doesNotMatch(reason(second), /machine-check/);
});

test('session-start: the discover note is only there when the plan gate is on', () => {
  const { dir } = tmpRepo({ planGate: false });
  const ctx = runHook('session-start', { cwd: dir, source: 'startup' }).json.hookSpecificOutput.additionalContext;
  assert.doesNotMatch(ctx, /discover skill/);
  const { dir: lite } = tmpRepo({ preset: 'lite' });
  assert.doesNotMatch(runHook('session-start', { cwd: lite, source: 'startup' }).json.hookSpecificOutput.additionalContext, /discover skill/);
});

test('init: PLAN.md is gitignored only when state is not synced through git', () => {
  const { init } = require('../scripts/init-project');
  const { dir: g } = tmpRepo();
  init({ target: g, tools: 'claude' });
  assert.doesNotMatch(fs.readFileSync(path.join(g, '.gitignore'), 'utf8'), /PLAN\.md/);
  const { dir: l } = tmpRepo();
  const answers = path.join(l, 'answers.json');
  fs.writeFileSync(answers, JSON.stringify({ stateSync: 'local' }));
  init({ target: l, tools: 'claude', answers });
  assert.match(fs.readFileSync(path.join(l, '.gitignore'), 'utf8'), /\.agents\/PLAN\.md/);
});
