'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { ROOT, FAKE, tmpRepo } = require('./helpers');
const { init } = require('../scripts/init-project');
const { exportSkills } = require('../scripts/export-skills');

const answers = path.join(ROOT, 'templates', 'answers.example.json');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? (e.name === '.git' ? [] : walk(p)) : [p];
  });
}

test('init writes placeholder-free files for every tool and keeps existing ones', () => {
  const { dir } = tmpRepo();
  fs.writeFileSync(path.join(dir, 'CLAUDE.md'), 'mine\n');
  const r = init({ target: dir, answers, 'with-git-hooks': true });
  const expected = [
    'AGENTS.md',
    'GEMINI.md',
    '.cursor/rules/agent-workflow.mdc',
    '.github/copilot-instructions.md',
    '.codex/agents/reviewer.toml',
    '.claude/settings.json',
    '.agents/config.json',
    '.agents/tools/msg.js',
    '.agents/tools/git-guard.js',
    '.githooks/pre-commit',
  ];
  for (const f of expected) assert.ok(r.written.includes(f), `missing ${f}`);
  assert.ok(r.kept.includes('CLAUDE.md'));
  assert.equal(fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8'), 'mine\n');
  const leftovers = walk(dir).filter((f) => /\{\{[A-Z_]+\}\}/.test(fs.readFileSync(f, 'utf8')));
  assert.deepEqual(leftovers, []);
  const cfg = JSON.parse(fs.readFileSync(path.join(dir, '.agents', 'config.json'), 'utf8'));
  assert.deepEqual(cfg.protectedFiles, ['src/db/schema.sql', 'src/auth/**']);
  assert.match(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8'), /\.agents\/LOG\.md/);
});

test('init --tools limits adapters; --dry-run writes nothing', () => {
  const { dir } = tmpRepo();
  const dry = init({ target: dir, tools: 'claude', 'dry-run': true });
  assert.ok(dry.written.includes('CLAUDE.md'));
  assert.ok(!dry.written.includes('GEMINI.md'));
  assert.ok(!fs.existsSync(path.join(dir, 'AGENTS.md')));
});

test('export-skills copies skills, rewrites plugin paths, skips init, keeps existing', () => {
  const { dir } = tmpRepo();
  const r = exportSkills({ target: dir, to: 'agents,cursor' });
  assert.ok(r.written.includes('.agents/skills/bug-intake'));
  assert.ok(r.written.includes('.cursor/skills/safe-change'));
  assert.ok(!r.written.some((w) => w.endsWith('/init')));
  const web = fs.readFileSync(path.join(dir, '.agents/skills/webapp-testing/SKILL.md'), 'utf8');
  assert.ok(!web.includes('CLAUDE_PLUGIN_ROOT'));
  assert.ok(fs.existsSync(path.join(dir, '.agents/skills/webapp-testing/scripts/smoke.mjs')));
  assert.ok(exportSkills({ target: dir, to: 'agents' }).kept.length > 0);
  assert.throws(() => exportSkills({ target: dir, to: 'nope' }));
});

test('git-guard blocks secrets and trailers for any tool', () => {
  const { dir, git } = tmpRepo();
  init({ target: dir, tools: 'codex', 'with-git-hooks': true });
  const guard = path.join(dir, '.agents/tools/git-guard.js');
  const run = (...a) => spawnSync('node', [guard, ...a], { cwd: dir, env: { ...process.env, AWK_HOOKS: '' } }).status;
  fs.writeFileSync(path.join(dir, 'k.js'), `x = "${FAKE.aws}"\n`);
  git('add', 'k.js');
  assert.equal(run('pre-commit'), 1);
  git('rm', '-q', '--cached', 'k.js');
  assert.equal(run('pre-commit'), 0);
  fs.writeFileSync(path.join(dir, 'm.txt'), 'feat: x\n\nCo-' + 'Authored-By: a <a@example.com>\n');
  assert.equal(run('commit-msg', 'm.txt'), 1);
  fs.writeFileSync(path.join(dir, 'm.txt'), 'feat: x\n');
  assert.equal(run('commit-msg', 'm.txt'), 0);
});

test('message log: post, inbox, claims, shared across worktrees', () => {
  const { dir, git } = tmpRepo();
  init({ target: dir, tools: 'claude' });
  const tool = path.join(dir, '.agents/tools/msg.js');
  const msg = (cwd, ...a) => execFileSync('node', [tool, ...a], { cwd, encoding: 'utf8', env: { ...process.env, AWK_SHARED_DIR: '' } });
  msg(dir, 'post', '--from', 'api', '--to', 'web', '--type', 'claim', '--topic', 'login', '--files', 'src/login.js', '--body', 'taking login');
  assert.match(msg(dir, 'claims'), /src\/login\.js/);
  assert.match(msg(dir, 'inbox', '--for', 'web'), /taking login/);
  assert.match(msg(dir, 'inbox', '--for', 'web'), /none/);
  const wt = `${dir}-wt`;
  git('worktree', 'add', '-q', wt, '-b', 'wt-branch');
  assert.equal(msg(wt, 'where').trim(), path.join(dir, '.agents', 'LOG.md'));
  assert.match(msg(wt, 'claims'), /src\/login\.js/);
  msg(wt, 'post', '--from', 'web', '--to', 'api', '--type', 'release', '--topic', 'login', '--files', 'src/login.js', '--body', 'done');
  assert.match(msg(dir, 'claims'), /src\/login\.js/, 'only the owner can release a claim');
  msg(wt, 'post', '--from', 'api', '--to', 'all', '--type', 'release', '--topic', 'login', '--body', 'done');
  assert.doesNotMatch(msg(dir, 'claims'), /src\/login\.js/);
});

test('closeout: agent, skill and report template exist and the closeout message type posts', () => {
  for (const f of ['agents/closer.md', 'skills/closeout/SKILL.md', 'skills/closeout/templates/closeout-report.md']) {
    assert.ok(fs.existsSync(path.join(ROOT, f)), f);
  }
  const { dir } = tmpRepo();
  const r = spawnSync('node', [path.join(ROOT, 'scripts', 'agent-msg.js'), 'post', '--from', 'closer', '--to', 'manager', '--type', 'closeout', '--topic', 'feat', '--body', 'ready'], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /closeout/);
});
