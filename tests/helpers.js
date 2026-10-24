'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
// Fake credentials are built at runtime so this file never contains one.
const FAKE = {
  aws: 'AKIA' + 'Q'.repeat(16),
  github: 'ghp' + '_' + 'a1B2'.repeat(9),
};

function tmpRepo(config) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'awk-test-')));
  const g = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'ignore' });
  g('init', '-q', '-b', 'feature');
  g('config', 'user.email', 'dev@example.com');
  g('config', 'user.name', 'Dev');
  g('config', 'commit.gpgsign', 'false');
  fs.writeFileSync(path.join(dir, 'README.md'), '# test\n');
  g('add', 'README.md');
  g('commit', '-q', '-m', 'chore: init');
  if (config) {
    fs.mkdirSync(path.join(dir, '.agents'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.agents', 'config.json'), JSON.stringify(config));
  }
  return { dir, git: g };
}

function runHook(name, input, env = {}) {
  const res = spawnSync('node', [path.join(ROOT, 'scripts', 'hooks', `${name}.js`)], {
    input: typeof input === 'string' ? input : JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, AWK_HOOKS: '', AWK_DISABLE: '', ...env },
  });
  let json = null;
  try {
    json = res.stdout ? JSON.parse(res.stdout) : null;
  } catch (_) {}
  return { code: res.status, stdout: res.stdout, json };
}

function decision(r) {
  const h = r.json && r.json.hookSpecificOutput;
  if (!h) return 'allow';
  return h.permissionDecision || (h.additionalContext ? 'warn' : 'allow');
}

module.exports = { ROOT, FAKE, tmpRepo, runHook, decision };
