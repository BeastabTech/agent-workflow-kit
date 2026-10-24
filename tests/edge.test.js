'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { FAKE, tmpRepo, runHook, decision } = require('./helpers');
const { init } = require('../scripts/init-project');
const { exportSkills, DESTS } = require('../scripts/export-skills');

const bash = (cwd, command, env) => runHook('pre-bash', { tool_name: 'Bash', tool_input: { command }, cwd }, env);
const COMMIT = 'git ' + 'commit';

test('init: local state sync gitignores state files; folder sync stores sharedDir', () => {
  const local = tmpRepo();
  const answers = path.join(local.dir, 'a.json');
  fs.writeFileSync(answers, JSON.stringify({ stateSync: 'local', workMode: 'worktree' }));
  init({ target: local.dir, answers, tools: 'claude' });
  const ignore = fs.readFileSync(path.join(local.dir, '.gitignore'), 'utf8');
  assert.match(ignore, /\.agents\/STATE\.md/);
  assert.match(fs.readFileSync(path.join(local.dir, 'AGENTS.md'), 'utf8'), /Worktree mode/);

  const folder = tmpRepo();
  const a2 = path.join(folder.dir, 'a.json');
  fs.writeFileSync(a2, JSON.stringify({ stateSync: 'folder', sharedDir: '../shared-agents' }));
  init({ target: folder.dir, answers: a2, tools: 'claude' });
  const cfg = JSON.parse(fs.readFileSync(path.join(folder.dir, '.agents', 'config.json'), 'utf8'));
  assert.equal(cfg.sharedDir, '../shared-agents');
});

test('init: unknown values fall back to safe defaults; --force overwrites', () => {
  const { dir } = tmpRepo();
  const answers = path.join(dir, 'a.json');
  fs.writeFileSync(answers, JSON.stringify({ workMode: 'weird', stateSync: 'cloud', commitPolicy: 'yolo', tools: 'cursor,unknown' }));
  const r = init({ target: dir, answers });
  const cfg = JSON.parse(fs.readFileSync(path.join(dir, '.agents', 'config.json'), 'utf8'));
  assert.equal(cfg.workMode, 'shared');
  assert.equal(cfg.stateSync, 'git');
  assert.equal(cfg.commitPolicy, 'on-request');
  assert.deepEqual(cfg.tools, ['cursor']);
  assert.ok(!r.written.includes('CLAUDE.md'));
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'old\n');
  init({ target: dir, answers, force: true });
  assert.notEqual(fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8'), 'old\n');
});

test('export-skills: every target, a subset, and a missing name', () => {
  const { dir } = tmpRepo();
  const r = exportSkills({ target: dir, to: Object.keys(DESTS).join(','), skills: 'tdd,nope' });
  assert.equal(r.written.length, Object.keys(DESTS).length);
  assert.deepEqual(r.missing, ['nope']);
  for (const base of Object.values(DESTS)) assert.ok(fs.existsSync(path.join(dir, base, 'tdd', 'SKILL.md')));
  const dry = exportSkills({ target: tmpRepo().dir, to: 'agents', 'dry-run': true });
  assert.ok(dry.written.length > 20);
});

test('message log: bad type and missing fields fail; thread and tail work; stdin body', () => {
  const { dir } = tmpRepo();
  init({ target: dir, tools: 'claude' });
  const tool = path.join(dir, '.agents/tools/msg.js');
  const run = (args, input) => spawnSync('node', [tool, ...args], { cwd: dir, encoding: 'utf8', input, env: { ...process.env, AWK_SHARED_DIR: '' } });
  assert.notEqual(run(['post', '--from', 'a', '--to', 'b', '--type', 'shout', '--topic', 't']).status, 0);
  assert.notEqual(run(['post', '--from', 'a', '--type', 'note', '--topic', 't']).status, 0);
  assert.equal(run(['post', '--from', 'a', '--to', 'b', '--type', 'question', '--topic', 'shape'], 'What fields?\n### not a header').status, 0);
  run(['post', '--from', 'b', '--to', 'a', '--type', 'answer', '--topic', 'shape', '--body', 'id and title']);
  run(['post', '--from', 'a', '--to', 'b', '--type', 'note', '--topic', 'other', '--body', 'x']);
  const thread = run(['thread', '--topic', 'shape']).stdout;
  assert.match(thread, /What fields\?/);
  assert.match(thread, /#### not a header/, 'body headings cannot break the log format');
  assert.doesNotMatch(thread, /Topic: other/);
  assert.match(run(['tail', '-n', '1']).stdout, /Topic: other/);
});

test('message log: AWK_SHARED_DIR moves the log to a shared folder', () => {
  const { dir } = tmpRepo();
  init({ target: dir, tools: 'claude' });
  const shared = fs.mkdtempSync(path.join(require('os').tmpdir(), 'awk-shared-'));
  const out = execFileSync('node', [path.join(dir, '.agents/tools/msg.js'), 'where'], { cwd: dir, encoding: 'utf8', env: { ...process.env, AWK_SHARED_DIR: shared } });
  assert.equal(out.trim(), path.join(shared, 'LOG.md'));
});

test('pre-bash: git -C path, commit -a staging, generic password asks, allowPaths skip', () => {
  const shared = tmpRepo({ workMode: 'shared' });
  assert.equal(decision(bash(shared.dir, `${COMMIT} -am "x"`)), 'deny');
  const { dir, git } = tmpRepo({ secretScan: { allowPaths: ['test/fixtures/**'] } });
  fs.mkdirSync(path.join(dir, 'test/fixtures'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'test/fixtures/k.js'), `k = "${FAKE.aws}"\n`);
  git('add', 'test/fixtures/k.js');
  assert.equal(decision(bash(dir, `${COMMIT} -m "test: fixture"`)), 'allow');
  git('rm', '-q', '--cached', 'test/fixtures/k.js');
  fs.writeFileSync(path.join(dir, 'cfg.js'), 'const password = "hunter2hunter2hunter2";\n');
  git('add', 'cfg.js');
  assert.equal(decision(bash(dir, `${COMMIT} -m "x"`)), 'ask');
  fs.writeFileSync(path.join(dir, 'cfg.js'), 'const password = "<your-password-here>";\n');
  git('add', 'cfg.js');
  assert.equal(decision(bash(dir, `${COMMIT} -m "x"`)), 'allow');
  const protectedRepo = tmpRepo({ protectedBranches: ['main'] });
  protectedRepo.git('branch', '-m', 'main');
  assert.equal(decision(bash('/', `git -C ${protectedRepo.dir} push origin main`)), 'ask');
  assert.equal(decision(bash(protectedRepo.dir, `${COMMIT} -m "x"`)), 'ask');
});

test('pre-bash: commands that only mention dangerous words are not blocked', () => {
  const { dir } = tmpRepo();
  assert.equal(decision(bash(dir, 'echo hello && ls -la')), 'allow');
  assert.equal(decision(bash(dir, 'git log --grep "DROP ' + 'TABLE"')), 'allow');
  assert.equal(decision(bash(dir, 'git push origin feature --tags')), 'allow');
});

test('pre-edit: MultiEdit edits array and notebooks are scanned', () => {
  const { dir } = tmpRepo();
  const multi = runHook('pre-edit', { tool_name: 'MultiEdit', tool_input: { file_path: path.join(dir, 'a.js'), edits: [{ old_string: 'a', new_string: `k="${FAKE.github}"` }] }, cwd: dir });
  assert.equal(decision(multi), 'deny');
  const nb = runHook('pre-edit', { tool_name: 'NotebookEdit', tool_input: { notebook_path: path.join(dir, 'n.ipynb'), new_source: `k="${FAKE.aws}"` }, cwd: dir });
  assert.equal(decision(nb), 'deny');
  const outside = runHook('pre-edit', { tool_name: 'Write', tool_input: { file_path: '/tmp/elsewhere.txt', content: 'hello' }, cwd: dir });
  assert.equal(decision(outside), 'allow');
});

test('session-start: counts recent messages; empty hand-off template stays quiet', () => {
  const { dir } = tmpRepo();
  init({ target: dir, tools: 'claude' });
  execFileSync('node', [path.join(dir, '.agents/tools/msg.js'), 'post', '--from', 'a', '--to', 'b', '--type', 'note', '--topic', 't', '--body', 'x'], { cwd: dir, env: { ...process.env, AWK_SHARED_DIR: '' } });
  const ctx = runHook('session-start', { cwd: dir, source: 'startup' }).json.hookSpecificOutput.additionalContext;
  assert.match(ctx, /1 agent message/);
  assert.doesNotMatch(ctx, /hand-off note exists/);
});

test('git-guard: off switch and outside a repo never block', () => {
  const { dir, git } = tmpRepo();
  init({ target: dir, tools: 'claude', 'with-git-hooks': true });
  const guard = path.join(dir, '.agents/tools/git-guard.js');
  fs.writeFileSync(path.join(dir, 'k.js'), `x = "${FAKE.aws}"\n`);
  git('add', 'k.js');
  assert.equal(spawnSync('node', [guard, 'pre-commit'], { cwd: dir, env: { ...process.env, AWK_HOOKS: 'off' } }).status, 0);
  assert.equal(spawnSync('node', [guard, 'pre-commit'], { cwd: require('os').tmpdir(), env: { ...process.env, AWK_HOOKS: '' } }).status, 0);
  assert.equal(spawnSync('node', [guard, 'unknown'], { cwd: dir }).status, 0);
});

test('git hooks work in a real commit', () => {
  const { dir, git } = tmpRepo();
  init({ target: dir, tools: 'claude', 'with-git-hooks': true });
  git('config', 'core.hooksPath', '.githooks');
  fs.writeFileSync(path.join(dir, 'k.js'), `x = "${FAKE.aws}"\n`);
  git('add', 'k.js');
  const env = { ...process.env, AWK_HOOKS: '' };
  assert.notEqual(spawnSync('git', ['commit', '-qm', 'feat: k'], { cwd: dir, env }).status, 0);
  fs.writeFileSync(path.join(dir, 'k.js'), 'x = process.env.X\n');
  git('add', 'k.js');
  assert.notEqual(spawnSync('git', ['commit', '-qm', 'feat: k', '-m', 'Co-' + 'Authored-By: a <a@example.com>'], { cwd: dir, env }).status, 0);
  assert.equal(spawnSync('git', ['commit', '-qm', 'feat: k'], { cwd: dir, env }).status, 0);
});

test('init: an existing doc elsewhere is linked, not duplicated', () => {
  const { dir } = tmpRepo();
  fs.mkdirSync(path.join(dir, 'docs/context/core'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'docs/context/core/architecture.md'), '# Ours\n');
  fs.writeFileSync(path.join(dir, 'docs/TESTING.md'), '# Ours\n');
  const r = init({ target: dir, tools: 'claude' });
  assert.ok(!fs.existsSync(path.join(dir, 'docs/context/ARCHITECTURE.md')));
  assert.ok(!fs.existsSync(path.join(dir, 'docs/context/TESTING.md')));
  const byFile = (a, b) => a.file.localeCompare(b.file);
  assert.deepEqual([...r.existing].sort(byFile), [
    { file: 'docs/context/ARCHITECTURE.md', found: 'docs/context/core/architecture.md' },
    { file: 'docs/context/TESTING.md', found: 'docs/TESTING.md' },
  ]);
  const agents = fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8');
  assert.match(agents, /`docs\/context\/core\/architecture\.md`/);
  assert.doesNotMatch(agents, /docs\/context\/ARCHITECTURE\.md/);
  assert.doesNotMatch(agents, /docs\/docs\//);
  assert.ok(fs.existsSync(path.join(dir, 'docs/context/CONVENTIONS.md')), 'other docs are still written');
});

test('message log: post prints a confirmation, not a second copy of the header', () => {
  const { dir } = tmpRepo();
  init({ target: dir, tools: 'claude' });
  const run = (args) => execFileSync('node', [path.join(dir, '.agents/tools/msg.js'), ...args], { cwd: dir, encoding: 'utf8', env: { ...process.env, AWK_SHARED_DIR: '' } });
  const posted = run(['post', '--from', 'a', '--to', 'b', '--type', 'note', '--topic', 't', '--body', 'x']);
  assert.match(posted, /^posted: \S+ · from a · to b · note\n$/);
  const tail = run(['tail', '-n', '1']);
  assert.equal(tail.match(/^### /gm).length, 1);
});
