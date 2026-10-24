'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { ROOT, tmpRepo, runHook, decision } = require('./helpers');
const B = require('../scripts/lib/budget');
const { init } = require('../scripts/init-project');
const { exportAgents } = require('../scripts/export-agents');
const { listAgents } = require('../scripts/lib/agents');
const msg = require('../scripts/agent-msg');

const spawnIn = (cwd, session, extra = {}) =>
  runHook('pre-agent', { tool_name: 'Agent', session_id: session, cwd, tool_input: { description: 'task', prompt: 'do work ' + Math.random(), subagent_type: 'explorer', ...extra } });
const context = (r) => (r.json && r.json.hookSpecificOutput && (r.json.hookSpecificOutput.additionalContext || r.json.hookSpecificOutput.permissionDecisionReason)) || '';

test('limitsFrom: defaults, overrides, and junk values ignored', () => {
  assert.equal(B.limitsFrom({}).maxParallel, 4);
  assert.equal(B.limitsFrom({ limits: { maxParallel: 2, maxSpawns: 'x', tokenBudget: -5 } }).maxParallel, 2);
  assert.equal(B.limitsFrom({ limits: { maxSpawns: 'x', tokenBudget: -5 } }).maxSpawns, 10);
  assert.equal(B.limitsFrom({ limits: { tokenBudget: -5 } }).tokenBudget, 0);
});

test('evaluate: ok, then warn near a limit, then ask over it', () => {
  const limits = { ...B.DEFAULT_LIMITS, maxSpawns: 10, maxParallel: 3 };
  const state = { spawns: [] };
  assert.equal(B.evaluate(state, limits, { promptChars: 100 }).level, 'ok');
  for (let i = 0; i < 6; i++) B.record(state, { done: true, hash: 'h' + i, est: 1 });
  assert.equal(B.evaluate(state, limits, { promptChars: 100 }).level, 'warn'); // 7th of 10
  for (let i = 0; i < 3; i++) B.record(state, { done: true, hash: 'g' + i, est: 1 });
  assert.equal(B.evaluate(state, limits, { promptChars: 100 }).level, 'warn'); // 10th of 10
  B.record(state, { done: true, hash: 'last', est: 1 });
  assert.equal(B.evaluate(state, limits, { promptChars: 100 }).level, 'ask'); // 11th
});

test('evaluate: parallel limit, big brief, duplicate brief, token budget', () => {
  const limits = { ...B.DEFAULT_LIMITS, maxParallel: 2, tokenBudget: 100000 };
  const state = { spawns: [] };
  B.record(state, { hash: 'a', est: 30000 });
  B.record(state, { hash: 'b', est: 30000 });
  assert.equal(B.evaluate(state, limits, { promptChars: 10 }).level, 'ask');
  B.finish(state, undefined);
  assert.equal(B.evaluate(state, limits, { promptChars: 10, hash: 'zzz' }).level, 'warn'); // 2 of 2 parallel, 90k of 100k tokens
  const big = B.evaluate({ spawns: [] }, B.DEFAULT_LIMITS, { promptChars: 20000 });
  assert.equal(big.level, 'warn');
  assert.match(big.messages.join(' '), /brief is 20000 characters/);
  const dup = B.evaluate({ spawns: [{ hash: 'same', done: true }] }, B.DEFAULT_LIMITS, { promptChars: 10, hash: 'same' });
  assert.match(dup.messages.join(' '), /same brief/);
});

test('plan: warns about too many agents, parallelism and a serial plan', () => {
  const l = B.DEFAULT_LIMITS;
  assert.equal(B.plan(l, { agents: 3, parallel: 3 }).warnings.length, 0);
  assert.match(B.plan(l, { agents: 12, parallel: 6 }).warnings.join(' '), /over the session limit/);
  assert.match(B.plan(l, { agents: 12, parallel: 6 }).warnings.join(' '), /parallel limit/);
  assert.match(B.plan(l, { agents: 3, parallel: 1 }).warnings.join(' '), /one after another/);
});

test('pre-agent hook: allows, warns, asks over the limit; sessions are separate', () => {
  const { dir } = tmpRepo({ limits: { maxSpawns: 4, maxParallel: 10, smallRepoFiles: 0 } });
  assert.equal(decision(spawnIn(dir, 's1')), 'allow'); // 1
  assert.equal(decision(spawnIn(dir, 's1')), 'allow'); // 2
  const third = spawnIn(dir, 's1'); // 3 of 4 = 75%
  assert.equal(decision(third), 'warn');
  assert.match(context(third), /3 of 4/);
  assert.equal(decision(spawnIn(dir, 's1')), 'warn'); // 4
  const fifth = spawnIn(dir, 's1');
  assert.equal(decision(fifth), 'ask');
  assert.match(context(fifth), /sub-agent 5/);
  assert.equal(decision(spawnIn(dir, 's2')), 'allow');
});

test('pre-agent hook: kill switches and broken input never block', () => {
  const { dir } = tmpRepo({ limits: { maxSpawns: 1, smallRepoFiles: 0 } });
  spawnIn(dir, 's');
  const env = (e) => runHook('pre-agent', { session_id: 's', cwd: dir, tool_input: { prompt: 'x', description: 'y' } }, e);
  assert.equal(decision(env({})), 'ask');
  assert.equal(decision(env({ AWK_DISABLE: 'agent-budget' })), 'allow');
  assert.equal(decision(env({ AWK_HOOKS: 'off' })), 'allow');
  assert.equal(decision(runHook('pre-agent', 'not json')), 'allow');
  assert.equal(runHook('subagent-stop', 'not json').code, 0);
});

test('subagent-stop frees a parallel slot', () => {
  const { dir } = tmpRepo({ limits: { maxParallel: 2, maxSpawns: 50, smallRepoFiles: 0 } });
  spawnIn(dir, 's');
  spawnIn(dir, 's');
  assert.equal(decision(spawnIn(dir, 's')), 'ask');
  runHook('subagent-stop', { session_id: 's', cwd: dir, agent_type: 'explorer' });
  runHook('subagent-stop', { session_id: 's', cwd: dir, agent_type: 'explorer' });
  runHook('subagent-stop', { session_id: 's', cwd: dir, agent_type: 'explorer' });
  assert.notEqual(decision(spawnIn(dir, 's')), 'ask');
});

test('init copies a working budget tool and writes limits and gitignore', () => {
  const { dir } = tmpRepo();
  const r = init({ target: dir, tools: 'codex,cursor' });
  assert.ok(r.written.includes('.agents/tools/budget.js'));
  assert.ok(r.gitignore.includes('.agents/.budget/'));
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, '.agents/config.json'), 'utf8')).limits.maxParallel, 4);
  const run = (...a) => spawnSync('node', ['.agents/tools/budget.js', ...a], { cwd: dir, encoding: 'utf8' });
  assert.match(run('limits').stdout, /maxSpawns: 10/);
  assert.match(run('plan', '--agents', '12', '--parallel', '6').stdout, /WARNING.*session limit/);
  assert.match(run('plan', '--agents', '3', '--parallel', '3').stdout, /Within limits/);
  assert.match(run('status').stdout, /0 started/);
  spawnIn(dir, 'sess');
  assert.match(run('status').stdout, /1 started.*\n- running explorer/);
});

test('agents export: every agent for codex and cursor, valid shape, existing kept', () => {
  const { dir } = tmpRepo();
  const names = listAgents().map((a) => a.meta.name);
  assert.ok(names.includes('closer') && names.includes('planner') && names.length >= 9);
  const r = exportAgents({ target: dir, to: 'codex,cursor' });
  assert.equal(r.written.length, names.length * 2);
  for (const n of names) {
    const toml = fs.readFileSync(path.join(dir, `.codex/agents/${n}.toml`), 'utf8');
    assert.match(toml, new RegExp(`^name = "${n}"\\n`));
    assert.match(toml, /developer_instructions = """\n[\s\S]+\n"""\n$/);
    assert.doesNotMatch(toml, /(?<!\.agents\/)skills\/[\w-]+\/SKILL/); // paths point at exported skills
  }
  assert.match(fs.readFileSync(path.join(dir, '.cursor/agents/reviewer.md'), 'utf8'), /readonly: true/);
  assert.doesNotMatch(fs.readFileSync(path.join(dir, '.cursor/agents/closer.md'), 'utf8'), /readonly/);
  assert.equal(exportAgents({ target: dir, to: 'codex' }).kept.length, names.length);
  assert.throws(() => exportAgents({ target: dir, to: 'vim' }), /Unknown --to/);
});

test('roster: one row per agent with state, claims and counts', () => {
  const { dir } = tmpRepo();
  const log = path.join(dir, '.agents');
  const post = (from, to, type, topic) => {
    const r = spawnSync('node', [path.join(ROOT, 'scripts/agent-msg.js'), 'post', '--from', from, '--to', to, '--type', type, '--topic', topic], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  };
  fs.mkdirSync(log, { recursive: true });
  post('manager', 'api', 'brief', 't1');
  post('api', 'all', 'claim', 't1');
  post('web', 'manager', 'blocked', 't2');
  post('user', 'api', 'instruction', 't1');
  let rows = Object.fromEntries(msg.roster(path.join(dir, '.agents')).map((r) => [r.name, r]));
  assert.equal(rows.api.claims, 1);
  assert.equal(rows.api.done, false);
  assert.equal(rows.web.lastType, 'blocked');
  assert.ok(!rows.user && !rows.all);
  post('api', 'manager', 'done', 't1');
  rows = Object.fromEntries(msg.roster(path.join(dir, '.agents')).map((r) => [r.name, r]));
  assert.equal(rows.api.done, true);
  assert.equal(rows.api.claims, 0);
  const out = spawnSync('node', [path.join(ROOT, 'scripts/agent-msg.js'), 'roster'], { cwd: dir, encoding: 'utf8' }).stdout;
  assert.match(out, /\| api \| done \|/);
  assert.match(out, /\| web \| blocked \|/);
});

test('instruction is an accepted message type', () => {
  assert.ok(msg.TYPES.includes('instruction'));
});

test('pre-agent hook: explorer in a small repo warns, other agents and big limits do not', () => {
  const { dir } = tmpRepo({});
  const run = (type, env) => runHook('pre-agent', { session_id: 'sm' + Math.random(), cwd: dir, tool_input: { description: 'd', prompt: 'p' + Math.random(), subagent_type: type } }, env);
  assert.equal(decision(run('explorer')), 'warn');
  assert.equal(decision(run('agent-workflow-kit:explorer')), 'warn');
  assert.equal(decision(run('reviewer')), 'allow');
  assert.equal(decision(run('explorer', { AWK_PROFILE: 'strict' })), 'ask');
  const { dir: big } = tmpRepo({ limits: { smallRepoFiles: 0 } });
  assert.equal(decision(runHook('pre-agent', { session_id: 'b', cwd: big, tool_input: { description: 'd', prompt: 'p', subagent_type: 'explorer' } })), 'allow');
});

test('triage: sizes the problem, then picks mode, model tier and agents for each edition', () => {
  const small = B.triage({ files: 1, read: 3 }, 'normal');
  assert.equal(small.size, 'S');
  assert.equal(small.agents, 0);
  assert.match(small.mode, /solo/);
  assert.match(small.model, /small/);
  const big = B.triage({ files: 12, read: 40, parts: 4 }, 'normal');
  assert.equal(big.size, 'XL');
  assert.ok(big.agents >= 4);
  assert.equal(B.triage({ files: 12, read: 40, parts: 4 }, 'lite').agents, 0);
  assert.ok(B.triage({ files: 12, read: 40, parts: 4 }, 'low-tokens').agents <= 2);
  assert.match(B.triage({ files: 6, read: 20 }, 'best').model, /strong/);
  const risky = B.triage({ files: 1, read: 2, risk: 'high' }, 'low-tokens');
  assert.notEqual(risky.size, 'S');
  assert.match(risky.review, /independent/);
  assert.doesNotMatch(risky.model, /small/);
});

test('triage --task: estimates the size from the text and decides without numbers', () => {
  const { estimate } = require('../scripts/lib/triage-auto');
  const { dir } = tmpRepo();
  const small = estimate('fix the typo in the heading', dir);
  assert.equal(small.risk, 'none');
  assert.equal(B.triage(small, 'auto').size, 'S');
  const big = estimate('rename the user model everywhere, update the payment webhook, migrate the schema, also add tests and docs', dir);
  assert.equal(big.risk, 'high');
  const t = B.triage(big, 'auto');
  assert.ok(['L', 'XL'].includes(t.size));
  assert.match(t.review, /independent/);
  const cli = spawnSync('node', [path.join(ROOT, 'scripts', 'agent-budget.js'), 'triage', '--task', 'add login with password reset'], { cwd: dir, encoding: 'utf8', env: { ...process.env, AWK_PRESET: 'auto' } });
  assert.match(cli.stdout, /Estimated from the task/);
  assert.match(cli.stdout, /risk high/);
});

test('loop.js: DONE on pass, STOP on round limit and on the same failure twice', () => {
  const fs2 = require('fs');
  const { dir } = tmpRepo({});
  const loop = (...a) => spawnSync('node', [path.join(ROOT, 'scripts', 'agent-loop.js'), ...a], { cwd: dir, encoding: 'utf8' }).stdout;
  fs2.writeFileSync(path.join(dir, 'flag'), 'no');
  const chk = `node -e "process.exit(require('fs').readFileSync('flag','utf8')==='yes'?0:(console.error('Error: expected yes',Math.random()>2?1:0),1))"`;
  loop('start', '--name', 'a', '--check', chk, '--max', '5');
  assert.match(loop('check', '--name', 'a'), /CONTINUE/);
  assert.match(loop('check', '--name', 'a'), /STOP: stuck/); // same failure twice
  assert.match(loop('check', '--name', 'a'), /already ended/);
  loop('start', '--name', 'b', '--check', chk);
  assert.match(loop('check', '--name', 'b'), /CONTINUE/);
  fs2.writeFileSync(path.join(dir, 'flag'), 'yes');
  assert.match(loop('check', '--name', 'b'), /DONE/);
  loop('start', '--name', 'c', '--max', '2', '--stuck', '9');
  assert.match(loop('step', '--name', 'c', '--result', 'fail', '--sig', 'one'), /CONTINUE/);
  assert.match(loop('step', '--name', 'c', '--result', 'fail', '--sig', 'two'), /STOP: round limit 2/);
  assert.match(loop('status'), /a: ended/);
});
