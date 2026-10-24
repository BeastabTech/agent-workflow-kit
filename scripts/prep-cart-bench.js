#!/usr/bin/env node
'use strict';
/**
 * Builds a small git repo for bench-real.js from benchmarks/fixtures/cart: one commit with the cart module
 * (the tasks' starting point) and one commit that adds each task's hidden tests (the "fix" commit).
 * Usage: node scripts/prep-cart-bench.js <dir>   then   node scripts/bench-real.js --repo <dir> --tasks benchmarks/real/cart-tasks.json
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const KIT = path.resolve(__dirname, '..');
const dir = path.resolve(process.argv[2] || path.join(require('os').tmpdir(), 'awk-cart-bench'));
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
fs.cpSync(path.join(KIT, 'benchmarks', 'fixtures', 'cart'), dir, { recursive: true });
const g = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' }).trim();
g('init', '-q', '-b', 'main');
g('config', 'user.email', 'bench@example.com');
g('config', 'user.name', 'bench');
fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules/\n.agents/LOG.md\n.agents/.budget/\n.agents/.loops/\n.agents/.gate/\n');
g('add', '-A');
g('commit', '-q', '-m', 'base');
const base = g('rev-parse', 'HEAD');
const hidden = path.join(KIT, 'benchmarks', 'fixtures', 'hidden');
for (const f of fs.readdirSync(hidden)) {
  fs.copyFileSync(path.join(hidden, f), path.join(dir, 'test', f));
}
g('add', '-A');
g('commit', '-q', '-m', 'hidden tests');
process.stdout.write(JSON.stringify({ dir, base, fix: g('rev-parse', 'HEAD') }) + '\n');
