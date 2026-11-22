'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { ROOT, FAKE, tmpRepo, runHook, decision } = require('./helpers');
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

const { suggestIgnores } = require('../scripts/init-project');
const { spawnSync: sp } = require('child_process');
const dirty = (dir) => sp('git', ['status', '--short', '--untracked-files=all'], { cwd: dir, encoding: 'utf8' }).stdout;

test('hook state never shows in git status, also in a repo init never touched', () => {
  const { dir } = tmpRepo(); // no .agents/config.json, no kit lines in .gitignore
  runHook('pre-agent', { session_id: 's', cwd: dir, tool_input: { prompt: 'p', description: 'd', subagent_type: 'reviewer' } });
  assert.ok(fs.existsSync(path.join(dir, '.agents', '.budget', 's.json')));
  assert.equal(fs.readFileSync(path.join(dir, '.agents', '.budget', '.gitignore'), 'utf8'), '*\n');
  assert.equal(dirty(dir), '');
  // a folder an older version left without the ignore file is repaired on the next write
  fs.unlinkSync(path.join(dir, '.agents', '.budget', '.gitignore'));
  assert.match(dirty(dir), /\.agents\/\.budget/);
  runHook('subagent-stop', { session_id: 's', cwd: dir, agent_type: 'reviewer' });
  assert.equal(dirty(dir), '');
});

test('loop state ignores itself too', () => {
  const { dir } = tmpRepo();
  sp('node', [path.join(ROOT, 'scripts', 'agent-loop.js'), 'start', '--name', 'fix', '--goal', 'green tests'], { cwd: dir, encoding: 'utf8' });
  assert.ok(fs.existsSync(path.join(dir, '.agents', '.loops', 'fix.json')));
  assert.equal(dirty(dir), '');
});

test('init: suggests .gitignore lines for what exists, adds the ones the owner accepted, flags committed env files', () => {
  const { dir, git } = tmpRepo();
  fs.mkdirSync(path.join(dir, 'node_modules'));
  fs.writeFileSync(path.join(dir, 'node_modules', 'x.js'), '');
  fs.writeFileSync(path.join(dir, '.env'), 'A=1\n');
  fs.mkdirSync(path.join(dir, 'build'));
  fs.writeFileSync(path.join(dir, 'build', 'tool.js'), '');
  fs.writeFileSync(path.join(dir, '.env.staging'), 'B=2\n');
  git('add', '-f', 'build/tool.js', '.env.staging');
  git('commit', '-q', '-m', 'chore: add files');
  const s = suggestIgnores(dir);
  assert.deepEqual(s.missing, ['.env', '.env.*', '!.env.example', 'node_modules/']); // build/ is committed on purpose: left alone
  assert.deepEqual(s.tracked, ['.env.staging']);
  // templates are not env files, also with an environment name before the suffix
  for (const f of ['.env.example', 'apps/mobile/.env.production.example', '.env.local.sample']) fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }), fs.writeFileSync(path.join(dir, f), 'A=\n');
  git('add', '-f', '.env.example', 'apps/mobile/.env.production.example', '.env.local.sample');
  assert.deepEqual(suggestIgnores(dir).tracked, ['.env.staging']);

  const dry = init({ target: dir, tools: 'claude', 'dry-run': true });
  assert.deepEqual(dry.gitignoreSuggest, s.missing);
  assert.deepEqual(dry.trackedEnvFiles, ['.env.staging']);
  assert.equal(fs.existsSync(path.join(dir, '.gitignore')), false); // a dry run writes nothing

  const answers = path.join(dir, 'a.json');
  fs.writeFileSync(answers, JSON.stringify({ gitignore: ['.env', '.env.*', '!.env.example', 'node_modules/'] }));
  const r = init({ target: dir, answers, tools: 'claude' });
  const ignore = fs.readFileSync(path.join(dir, '.gitignore'), 'utf8');
  for (const line of ['.env', 'node_modules/', '.agents/.budget/', '.claude/settings.local.json']) assert.ok(ignore.split('\n').includes(line), line);
  assert.deepEqual(r.gitignoreSuggest, []);
  assert.doesNotMatch(dirty(dir), /node_modules|\.env$|a\.json.*\.env/m);
  assert.deepEqual(suggestIgnores(fs.mkdtempSync(path.join(require('os').tmpdir(), 'awk-nogit-'))), { missing: [], tracked: [] });
});

test('init: settings not answered are listed as unset, the base branch comes from git, session-start names what is open', () => {
  const { dir } = tmpRepo(); // branch "feature"
  const answers = path.join(dir, 'a.json');
  fs.writeFileSync(answers, JSON.stringify({ timezone: 'Asia/Kolkata', workMode: 'shared' }));
  const r = init({ target: dir, answers, tools: 'claude' });
  const cfg = JSON.parse(fs.readFileSync(path.join(dir, '.agents', 'config.json'), 'utf8'));
  assert.deepEqual(cfg.unset, ['owners', 'protectedFiles', 'commitPolicy', 'mergeFlow']);
  assert.deepEqual(r.unset, cfg.unset);
  assert.equal(cfg.baseBranch, 'feature');
  assert.ok(cfg.protectedBranches.includes('feature'));
  const note = runHook('session-start', { cwd: dir, source: 'startup' }).json.hookSpecificOutput.additionalContext;
  assert.match(note, /Setup questions not asked yet: owners, protectedFiles, commitPolicy, mergeFlow/);
  cfg.unset = [];
  fs.writeFileSync(path.join(dir, '.agents', 'config.json'), JSON.stringify(cfg));
  assert.doesNotMatch(runHook('session-start', { cwd: dir, source: 'startup' }).json.hookSpecificOutput.additionalContext, /Setup questions/);
});

test('back-merge: a branch that runs ahead may not come into a feature branch; integration and long-lived branches may take it', () => {
  const { dir, git } = tmpRepo({ protectedBranches: ['main'], mergeFlow: { noBackMerge: ['dev'] } }); // on branch "feature"
  const bash = (command, env) => runHook('pre-bash', { cwd: dir, tool_input: { command } }, env);
  for (const cmd of ['git merge dev', 'git merge --no-ff origin/dev', 'git pull origin dev', 'git rebase dev', 'git fetch && git merge refs/remotes/origin/dev']) {
    const r = bash(cmd);
    assert.equal(decision(r), 'ask', cmd);
    assert.match(r.json.hookSpecificOutput.permissionDecisionReason, /back-merge.*git switch -c integrate\/feature-into-dev origin\/dev/);
  }
  assert.equal(decision(bash('git merge dev', { AWK_PROFILE: 'strict' })), 'deny');
  assert.equal(decision(bash('git merge dev', { AWK_DISABLE: 'back-merge' })), 'allow');
  for (const cmd of ['git merge main', 'git pull', 'git merge --abort', 'git merge feat/dev-tools', 'git log dev', 'git push origin feature', 'git diff dev...HEAD']) assert.equal(decision(bash(cmd)), 'allow', cmd);
  git('switch', '-q', '-c', 'integrate/feature-into-dev');
  assert.equal(decision(bash('git merge dev')), 'allow'); // cut from dev to resolve conflicts there
  assert.equal(decision(bash('git merge --no-ff origin/feature')), 'allow');
  git('switch', '-q', '-c', 'dev');
  assert.equal(decision(bash('git pull origin dev')), 'allow');
  git('switch', '-q', '-c', 'main');
  assert.equal(decision(bash('git merge dev')), 'allow'); // long-lived branches follow the release flow, not this rule
  const plain = tmpRepo({});
  assert.equal(decision(runHook('pre-bash', { cwd: plain.dir, tool_input: { command: 'git merge dev' } })), 'allow'); // nothing configured: no rule
});

test('merge flow: init stores it, session-start states the rule, a feature branch keeps no trace of the target after an integration merge', () => {
  const { dir } = tmpRepo();
  const answers = path.join(dir, 'a.json');
  fs.writeFileSync(answers, JSON.stringify({ mergeFlow: { noBackMerge: ['dev'], notes: ['PR into dev, owner approves'] } }));
  init({ target: dir, answers, tools: 'claude' });
  const cfg = JSON.parse(fs.readFileSync(path.join(dir, '.agents', 'config.json'), 'utf8'));
  assert.deepEqual(cfg.mergeFlow, { noBackMerge: ['dev'], integrationPrefix: 'integrate/', notes: ['PR into dev, owner approves'] });
  assert.ok(!cfg.unset.includes('mergeFlow'));
  assert.match(runHook('session-start', { cwd: dir, source: 'startup' }).json.hookSpecificOutput.additionalContext, /Merge rule: never merge, pull or rebase dev into a feature branch/);

  // The flow the skill describes, on a real conflict: dev and the feature both change the same line.
  const w = tmpRepo();
  const write = (text) => fs.writeFileSync(path.join(w.dir, 'app.txt'), text);
  write('one\n');
  w.git('add', 'app.txt');
  w.git('commit', '-q', '-m', 'feat: base');
  w.git('switch', '-q', '-c', 'dev');
  write('one from dev\n');
  w.git('commit', '-q', '-am', 'feat: dev change');
  w.git('switch', '-q', 'feature');
  write('one from feature\n');
  w.git('commit', '-q', '-am', 'feat: feature change');
  const tree = sp('git', ['merge-tree', '--write-tree', '--name-only', 'dev', 'feature'], { cwd: w.dir, encoding: 'utf8' });
  if (tree.status === 1) assert.match(tree.stdout, /app\.txt/); // measured without touching the checkout (git 2.38+)
  w.git('switch', '-q', '-c', 'integrate/feature-into-dev', 'dev');
  assert.notEqual(sp('git', ['merge', '--no-ff', 'feature'], { cwd: w.dir }).status, 0);
  write('one from dev and feature\n');
  w.git('commit', '-q', '-am', 'merge: feature into dev');
  const log = (ref) => sp('git', ['log', '--format=%s', ref], { cwd: w.dir, encoding: 'utf8' }).stdout;
  assert.match(log('integrate/feature-into-dev'), /feature change/);
  assert.match(log('integrate/feature-into-dev'), /dev change/);
  assert.doesNotMatch(log('feature'), /dev change/); // the feature branch never received dev
});

// ---- npm package, install manifest and removal
const { remove } = require('../scripts/remove-project');
const MF = require('../scripts/lib/manifest');
const cli = (cwd, ...a) => sp(process.execPath, [path.join(ROOT, 'bin', 'agent-workflow-kit.js'), ...a], { cwd, encoding: 'utf8' });
const tree = (dir) => sp('git', ['ls-files', '--others', '--cached', '--exclude-standard'], { cwd: dir, encoding: 'utf8' }).stdout.split('\n').filter(Boolean).sort();

test('remove undoes init: unchanged kit files go, edited ones and the project\'s own files stay, .gitignore is restored', () => {
  const { dir } = tmpRepo();
  fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules/\n');
  fs.mkdirSync(path.join(dir, 'docs'));
  fs.writeFileSync(path.join(dir, 'docs', 'mine.md'), '# mine\n');
  const before = tree(dir);
  const r = init({ target: dir, tools: 'claude,codex', 'with-git-hooks': true });
  exportSkills({ target: dir, to: 'agents' });
  const m = MF.read(dir);
  for (const rel of r.written) assert.ok(m.files[rel], `${rel} missing from the manifest`);
  assert.ok(Object.keys(m.files).some((f) => f.startsWith('.agents/skills/')));
  assert.ok(m.gitignore.includes('.agents/.budget/') && !m.gitignore.includes('node_modules/'));

  fs.appendFileSync(path.join(dir, 'AGENTS.md'), '\nOur own rule.\n'); // the owner edited this one
  runHook('pre-agent', { session_id: 's', cwd: dir, tool_input: { prompt: 'p', description: 'd', subagent_type: 'reviewer' } }); // local state

  const dry = remove({ target: dir });
  assert.equal(dry.applied, false);
  assert.deepEqual(dry.keptEdited, ['AGENTS.md']);
  assert.ok(fs.existsSync(path.join(dir, '.agents', 'config.json'))); // a dry run deletes nothing

  const done = remove({ target: dir, yes: true });
  assert.deepEqual(done.keptEdited, ['AGENTS.md']);
  assert.ok(done.localState.includes('.agents/.budget/'));
  assert.equal(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8'), 'node_modules/\n');
  assert.deepEqual(tree(dir), [...before, '.agents/kit-manifest.json', 'AGENTS.md'].sort());
  assert.deepEqual(Object.keys(MF.read(dir).files), ['AGENTS.md']); // kept so a later run can finish

  remove({ target: dir, yes: true, force: true });
  assert.deepEqual(tree(dir), before);
  assert.equal(fs.existsSync(path.join(dir, '.agents')), false);
});

test('remove without a manifest deletes nothing; a manifest cannot point outside the project', () => {
  const { dir } = tmpRepo();
  fs.mkdirSync(path.join(dir, '.agents', 'tools'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.agents', 'tools', 'msg.js'), '');
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# old install\n');
  const r = remove({ target: dir, yes: true });
  assert.deepEqual(r.removed, []);
  assert.match(r.notes.join(' '), /No install manifest.*Kit paths found: AGENTS\.md, \.agents/);
  assert.ok(fs.existsSync(path.join(dir, 'AGENTS.md')));
  assert.deepEqual(remove({ target: dir, yes: true, force: true }).removed, ['.agents/tools/']);
  assert.ok(fs.existsSync(path.join(dir, 'AGENTS.md'))); // never guessed at

  const outside = path.join(path.dirname(dir), `outside-${path.basename(dir)}.txt`);
  fs.writeFileSync(outside, 'keep');
  fs.mkdirSync(path.join(dir, '.agents'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.agents', 'kit-manifest.json'), JSON.stringify({ files: { [`../${path.basename(outside)}`]: MF.hashFile(outside), [outside]: MF.hashFile(outside) } }));
  remove({ target: dir, yes: true, force: true });
  assert.equal(fs.readFileSync(outside, 'utf8'), 'keep');
});

test('npm package: the CLI routes to the scripts, works on the current folder, and ships what it needs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.notEqual(pkg.private, true);
  assert.equal(pkg.publishConfig.access, 'public');
  assert.deepEqual(pkg.dependencies || {}, {}); // the kit stays zero-dependency
  for (const f of [...pkg.files.filter((x) => !x.startsWith('!')), ...Object.values(pkg.bin)]) assert.ok(fs.existsSync(path.join(ROOT, f)), `${f} is listed in package.json but missing`);
  assert.ok(pkg.files.includes('hooks') && pkg.files.includes('.claude-plugin')); // the package is also the plugin

  const { dir } = tmpRepo();
  assert.equal(cli(dir, 'version').stdout.trim(), pkg.version);
  assert.match(cli(dir, 'help').stdout, /init[\s\S]*export-skills[\s\S]*remove/);
  assert.equal(cli(dir, 'nonsense').status, 1);
  assert.equal(cli(dir, 'init', '--preset', 'lite', '--tools', 'claude').status, 0);
  assert.ok(fs.existsSync(path.join(dir, 'AGENTS.md')) && fs.existsSync(path.join(dir, '.agents', 'kit-manifest.json')));
  assert.equal(JSON.parse(cli(dir, 'remove').stdout).applied, false);
  assert.equal(JSON.parse(cli(dir, 'remove', '--yes').stdout).applied, true);
  assert.equal(fs.existsSync(path.join(dir, 'AGENTS.md')), false);
});
