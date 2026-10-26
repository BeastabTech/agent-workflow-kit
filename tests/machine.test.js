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
