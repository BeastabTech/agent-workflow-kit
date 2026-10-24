'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./helpers');
const { vars, normalise } = require('../scripts/init-project');

function frontmatter(file) {
  const text = fs.readFileSync(file, 'utf8');
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  assert.ok(m, `${file}: missing frontmatter`);
  const out = {};
  for (const line of m[1].split('\n')) {
    const kv = /^([\w-]+):\s*(.*)$/.exec(line);
    if (kv) out[kv[1]] = kv[2];
  }
  return { meta: out, text };
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

test('every skill has a matching name, a "use when" description and stays short', () => {
  const dir = path.join(ROOT, 'skills');
  for (const name of fs.readdirSync(dir)) {
    const { meta, text } = frontmatter(path.join(dir, name, 'SKILL.md'));
    assert.equal(meta.name, name, `skills/${name}: name mismatch`);
    assert.ok(meta.description && meta.description.length > 60, `skills/${name}: description too short`);
    assert.match(meta.description, /\bUse\b/, `skills/${name}: description should say when to use it`);
    assert.ok(text.split('\n').length < 500, `skills/${name}: SKILL.md over 500 lines`);
  }
});

test('the deploy skill only runs when invoked by a human', () => {
  const { meta } = frontmatter(path.join(ROOT, 'skills', 'deploy', 'SKILL.md'));
  assert.equal(meta['disable-model-invocation'], 'true');
});

test('every agent has name, description and a tools list; read-only agents cannot write', () => {
  for (const file of fs.readdirSync(path.join(ROOT, 'agents'))) {
    const { meta } = frontmatter(path.join(ROOT, 'agents', file));
    assert.equal(meta.name, file.replace(/\.md$/, ''));
    assert.ok(meta.description && meta.tools, `agents/${file}: description and tools required`);
    if (['reviewer', 'explorer', 'security-reviewer'].includes(meta.name)) {
      assert.doesNotMatch(meta.tools, /\b(Write|Edit)\b/, `${meta.name} must be read-only`);
    }
  }
});

test('hooks.json is valid and every script it points to exists', () => {
  const hooks = JSON.parse(fs.readFileSync(path.join(ROOT, 'hooks', 'hooks.json'), 'utf8')).hooks;
  for (const groups of Object.values(hooks)) {
    for (const g of groups) {
      for (const h of g.hooks) {
        const m = /\/(scripts\/[\w/.-]+\.js)/.exec(h.command);
        assert.ok(m && fs.existsSync(path.join(ROOT, m[1])), `missing script for ${h.command}`);
      }
    }
  }
});

test('manifests parse and agree on the plugin name', () => {
  const plugin = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8'));
  const market = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin', 'marketplace.json'), 'utf8'));
  assert.equal(market.plugins[0].name, plugin.name);
  assert.doesNotMatch(plugin.name, /^(claude|anthropic)-/);
});

test('every {{PLACEHOLDER}} in the templates is filled by init', () => {
  const known = new Set(Object.keys(vars(normalise({}))));
  for (const file of walk(path.join(ROOT, 'templates'))) {
    for (const [, key] of fs.readFileSync(file, 'utf8').matchAll(/\{\{([A-Z_]+)\}\}/g)) {
      assert.ok(known.has(key), `${path.relative(ROOT, file)}: unknown placeholder ${key}`);
    }
  }
});

test('the web smoke script parses and explains a missing Playwright', () => {
  const { spawnSync } = require('child_process');
  const script = path.join(ROOT, 'skills', 'webapp-testing', 'scripts', 'smoke.mjs');
  assert.equal(spawnSync('node', ['--check', script]).status, 0);
  const os = require('os');
  const r = spawnSync('node', [script, 'http://localhost:1'], { cwd: os.tmpdir(), encoding: 'utf8', env: { ...process.env, NODE_PATH: '' } });
  if (r.status === 2) assert.match(r.stderr, /Playwright not found/);
});
