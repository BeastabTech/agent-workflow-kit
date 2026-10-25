'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { FAKE, tmpRepo, runHook, decision } = require('./helpers');

const bash = (cwd, command, env) => runHook('pre-bash', { tool_name: 'Bash', tool_input: { command }, cwd }, env);
const edit = (cwd, file_path, content, env) => runHook('pre-edit', { tool_name: 'Write', tool_input: { file_path, content }, cwd }, env);
const COMMIT = 'git ' + 'commit';
const TRAILER = 'Co-' + 'Authored-By: Bot <bot@example.com>';

test('ai-trailers: blocks Co-Authored-By and "Generated with" in a commit message', () => {
  const { dir } = tmpRepo();
  assert.equal(decision(bash(dir, `${COMMIT} -m "feat: x" -m "${TRAILER}"`)), 'deny');
  assert.equal(decision(bash(dir, `${COMMIT} -m "feat: x" -m "Generated ` + `with some tool"`)), 'deny');
  assert.equal(decision(bash(dir, `${COMMIT} -m "feat: add login"`)), 'allow');
});

test('ai-trailers: reads the message file passed with -F', () => {
  const { dir } = tmpRepo();
  fs.writeFileSync(path.join(dir, 'msg.txt'), `fix: y\n\n${TRAILER}\n`);
  assert.equal(decision(bash(dir, `${COMMIT} -F msg.txt`)), 'deny');
});

test('ai-trailers: personal toggle turns it off', () => {
  const { dir } = tmpRepo();
  const r = bash(dir, `${COMMIT} -m "x" -m "${TRAILER}"`, { CLAUDE_PLUGIN_OPTION_BLOCK_AI_TRAILERS: 'false' });
  assert.equal(decision(r), 'allow');
});

test('secret-scan: blocks a staged credential, allows clean commits', () => {
  const { dir, git } = tmpRepo();
  fs.writeFileSync(path.join(dir, 'a.js'), `const k = "${FAKE.aws}";\n`);
  git('add', 'a.js');
  assert.equal(decision(bash(dir, `${COMMIT} -m "feat: a"`)), 'deny');
  fs.writeFileSync(path.join(dir, 'a.js'), 'const k = process.env.KEY;\n');
  git('add', 'a.js');
  assert.equal(decision(bash(dir, `${COMMIT} -m "feat: a"`)), 'allow');
});

test('secret-scan: blocks a staged env file but not .env.example', () => {
  const { dir, git } = tmpRepo();
  fs.writeFileSync(path.join(dir, '.env.example'), 'KEY=\n');
  git('add', '.env.example');
  assert.equal(decision(bash(dir, `${COMMIT} -m "docs: env"`)), 'allow');
  fs.writeFileSync(path.join(dir, '.env'), 'KEY=1\n');
  assert.equal(decision(bash(dir, `git add .env && ${COMMIT} -m "x"`)), 'deny');
});

test('secret-scan: the awk-allow-secret pragma skips a line', () => {
  const { dir, git } = tmpRepo();
  fs.writeFileSync(path.join(dir, 'fixture.js'), `const k = "${FAKE.aws}"; // awk-allow-secret\n`);
  git('add', 'fixture.js');
  assert.equal(decision(bash(dir, `${COMMIT} -m "test: fixture"`)), 'allow');
});

test('explicit-staging: denied in shared mode, warned in worktree mode, ignored without team config', () => {
  assert.equal(decision(bash(tmpRepo({ workMode: 'shared' }).dir, 'git add -A')), 'deny');
  assert.equal(decision(bash(tmpRepo({ workMode: 'worktree' }).dir, 'git add .')), 'warn');
  assert.equal(decision(bash(tmpRepo().dir, 'git add -A')), 'allow');
  assert.equal(decision(bash(tmpRepo({ workMode: 'shared' }).dir, 'git add src/a.js')), 'allow');
});

test('force-push: --force denied, --force-with-lease asks', () => {
  const { dir } = tmpRepo();
  assert.equal(decision(bash(dir, 'git push --force origin feature')), 'deny');
  assert.equal(decision(bash(dir, 'git push origin +feature')), 'deny');
  assert.equal(decision(bash(dir, 'git push --force-with-lease origin feature')), 'ask');
  assert.equal(decision(bash(dir, 'git push origin feature')), 'allow');
});

test('protected-branch: push to a protected branch asks', () => {
  const { dir } = tmpRepo({ protectedBranches: ['main'] });
  assert.equal(decision(bash(dir, 'git push origin main')), 'ask');
  assert.equal(decision(bash(dir, 'git push origin feature')), 'allow');
});

test('destructive-db: blocks clear cases, skips read-only commands', () => {
  const { dir } = tmpRepo();
  const cases = ['npx prisma migrate ' + 'reset', 'psql -c "DROP ' + 'TABLE users"', 'psql -c "DELETE ' + 'FROM users;"', 'redis-cli FLUSH' + 'ALL', 'terraform ' + 'destroy'];
  for (const cmd of cases) assert.equal(decision(bash(dir, cmd)), 'deny', cmd);
  assert.equal(decision(bash(dir, 'psql -c "DELETE ' + 'FROM users WHERE id = 1;"')), 'allow');
  assert.equal(decision(bash(dir, 'grep -rn "DROP ' + 'TABLE" migrations')), 'allow');
  assert.equal(decision(bash(tmpRepo({ destructiveDb: 'ask' }).dir, 'npx prisma db ' + 'push')), 'ask');
});

test('kill switches: AWK_HOOKS=off and AWK_DISABLE', () => {
  const { dir } = tmpRepo();
  assert.equal(decision(bash(dir, 'git push --force', { AWK_HOOKS: 'off' })), 'allow');
  assert.equal(decision(bash(dir, 'git push --force', { AWK_DISABLE: 'force-push' })), 'allow');
});

test('broken input never blocks', () => {
  assert.equal(runHook('pre-bash', 'not json').code, 0);
  assert.equal(decision(runHook('pre-bash', 'not json')), 'allow');
  assert.equal(decision(runHook('pre-edit', '{}')), 'allow');
});

test('pre-edit: protected file asks, env file asks, secret in content denies', () => {
  const { dir } = tmpRepo({ protectedFiles: ['src/auth/**'] });
  assert.equal(decision(edit(dir, path.join(dir, 'src/auth/token.js'), 'x')), 'ask');
  assert.equal(decision(edit(dir, path.join(dir, 'src/other.js'), 'x')), 'allow');
  assert.equal(decision(edit(dir, path.join(dir, '.env'), 'A=1')), 'ask');
  assert.equal(decision(edit(dir, path.join(dir, 'src/cfg.js'), `const t = "${FAKE.github}";`)), 'deny');
});

test('pre-edit: protected file asks even when the tool passes a symlinked path', () => {
  const { dir } = tmpRepo({ protectedFiles: ['src/auth/**'] });
  fs.mkdirSync(path.join(dir, 'src/auth'), { recursive: true });
  const link = path.join(os.tmpdir(), `awk-link-${process.pid}`);
  fs.symlinkSync(dir, link, 'junction');
  try {
    assert.equal(decision(edit(link, path.join(link, 'src/auth/token.js'), 'x')), 'ask');
    assert.equal(decision(edit(link, path.join(link, 'src/auth/not/yet/created.js'), 'x')), 'ask'); // parent dirs missing
  } finally {
    fs.unlinkSync(link);
  }
});

test('session-start: silent without .agents, notes hand-off and compaction', () => {
  const plain = tmpRepo();
  assert.equal(runHook('session-start', { cwd: plain.dir, source: 'startup' }).stdout, '');
  const kit = tmpRepo({ workMode: 'worktree' });
  fs.writeFileSync(path.join(kit.dir, '.agents', 'HANDOFF.md'), '# Hand-off\n\nNext: finish the login form.\n');
  const ctx = runHook('session-start', { cwd: kit.dir, source: 'compact' }).json.hookSpecificOutput.additionalContext;
  assert.match(ctx, /worktree/);
  assert.match(ctx, /HANDOFF\.md/);
  assert.match(ctx, /compacted/);
});

test('session-start: reply style option', () => {
  const { dir } = tmpRepo();
  const r = runHook('session-start', { cwd: dir }, { CLAUDE_PLUGIN_OPTION_REPLY_STYLE: 'caveman-lite' });
  assert.match(r.json.hookSpecificOutput.additionalContext, /terse/);
});

test('profiles: minimal skips the soft checks, strict hardens them, unknown falls back to standard', () => {
  const shared = tmpRepo({ workMode: 'worktree', protectedFiles: ['src/auth/**'] });
  const stage = (env) => decision(bash(shared.dir, 'git add -A', env));
  assert.equal(stage({}), 'warn'); // standard, worktree
  assert.equal(stage({ AWK_PROFILE: 'strict' }), 'deny');
  assert.equal(stage({ AWK_PROFILE: 'minimal' }), 'allow');
  assert.equal(stage({ AWK_PROFILE: 'nonsense' }), 'warn');
  assert.equal(decision(bash(shared.dir, 'git push --force', { AWK_PROFILE: 'minimal' })), 'deny'); // safety nets stay
  assert.equal(decision(edit(shared.dir, path.join(shared.dir, 'src/auth/x.js'), 'x')), 'ask');
  assert.equal(decision(edit(shared.dir, path.join(shared.dir, 'src/auth/x.js'), 'x', { AWK_PROFILE: 'minimal' })), 'allow');
  assert.equal(decision(edit(shared.dir, path.join(shared.dir, '.env'), 'A=1', { AWK_PROFILE: 'minimal' })), 'allow');
  const viaOption = decision(edit(shared.dir, path.join(shared.dir, '.env'), 'A=1', { CLAUDE_PLUGIN_OPTION_PROFILE: 'minimal' }));
  assert.equal(viaOption, 'allow');
  const viaConfig = tmpRepo({ profile: 'minimal', protectedFiles: ['a/**'] });
  assert.equal(decision(edit(viaConfig.dir, path.join(viaConfig.dir, 'a/x.js'), 'x')), 'allow');
  assert.equal(decision(edit(viaConfig.dir, path.join(viaConfig.dir, 'a/x.js'), 'x', { AWK_PROFILE: 'standard' })), 'ask'); // env beats config
});

test('profiles: strict turns a spawn-budget warning into a question', () => {
  const { dir } = tmpRepo({ limits: { maxSpawns: 4, maxParallel: 10 } });
  const spawn = (env) => runHook('pre-agent', { session_id: 'p', cwd: dir, tool_input: { description: 'd', prompt: 'x' + Math.random() } }, env);
  spawn({});
  spawn({});
  assert.equal(decision(spawn({})), 'warn');
  assert.equal(decision(spawn({ AWK_PROFILE: 'strict' })), 'ask');
});

test('done gate: blocks a stop after code edits without tests, once, per edition', () => {
  const fs2 = require('fs');
  const path2 = require('path');
  const { tmpRepo, runHook } = require('./helpers');
  const { dir } = tmpRepo({});
  const T = path2.join(dir, 't.jsonl');
  const use = (id, name, input) => JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', id, name, input }] } });
  const res = (id, text) => JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: id, content: text }] } });
  const write = (...l) => fs2.writeFileSync(T, l.join('\n') + '\n');
  const stop = (env, sid) => runHook('stop', { cwd: dir, transcript_path: T, session_id: sid }, env);
  const blocked = (r) => /"decision":"block"/.test(r.stdout || r);

  write(use('1', 'Edit', { file_path: '/p/src/a.ts' }));
  assert.ok(blocked(stop({ AWK_PRESET: 'best' }, 's1')), 'edit without a test run blocks');
  assert.ok(blocked(stop({ AWK_PRESET: 'best' }, 's1')), 'best blocks up to twice');
  assert.ok(!blocked(stop({ AWK_PRESET: 'best' }, 's1')), 'third stop is allowed: capped per session');
  assert.ok(!blocked(stop({ AWK_PRESET: 'lite' }, 's2')), 'lite never blocks');
  assert.ok(!blocked(stop({ AWK_PRESET: 'normal' }, 's2b')), 'normal and auto do not gate: it cost tokens without a measured gain');
  assert.ok(!blocked(stop({ AWK_PRESET: 'best', AWK_DISABLE: 'done-gate' }, 's3')));

  write(use('1', 'Edit', { file_path: '/p/src/a.ts' }), use('2', 'Bash', { command: 'cd apps/x && npx jest src/a' }), res('2', 'Tests: 3 passed, 3 total'));
  assert.ok(!blocked(stop({ AWK_PRESET: 'normal' }, 's4')), 'tests ran and passed');
  assert.ok(blocked(stop({ AWK_PRESET: 'best' }, 's5')), 'best also wants a test file touched');

  write(use('1', 'Edit', { file_path: '/p/src/a.ts' }), use('2', 'Write', { file_path: '/p/src/a.spec.ts' }), use('3', 'Bash', { command: 'npx jest' }), res('3', 'Tests: 1 failed, 2 passed, 3 total'));
  assert.ok(blocked(stop({ AWK_PRESET: 'best' }, 's6')), 'a failing last run blocks');

  write(use('1', 'Edit', { file_path: '/p/README.md' }));
  assert.ok(!blocked(stop({ AWK_PRESET: 'best' }, 's7')), 'docs only: nothing to test');

  write(use('1', 'Edit', { file_path: '/p/src/a.ts' }), use('2', 'Write', { file_path: '/p/src/a.spec.ts' }), use('3', 'Bash', { command: 'npx jest' }), res('3', 'Tests: 3 passed, 3 total'));
  assert.ok(!blocked(stop({ AWK_PRESET: 'best' }, 's8')), 'best satisfied');
});
