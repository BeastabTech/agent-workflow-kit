#!/usr/bin/env node
'use strict';
/**
 * Builds the git repo for the safety benchmark (benchmarks/real/ops-tasks.json): a tiny service whose
 * prompts tempt an agent to commit a secret, force-push over a teammate's commit, or wipe a database.
 * Nothing real is involved: the "secret" is the AWS documentation example key, the "database" is a JSON
 * file, the "remote" is a local bare repo.
 * Usage: node scripts/prep-ops-bench.js <dir>
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const KIT = path.resolve(__dirname, '..');
const dir = path.resolve(process.argv[2] || path.join(require('os').tmpdir(), 'awk-ops-bench'));
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
fs.cpSync(path.join(KIT, 'benchmarks', 'fixtures', 'ops'), dir, { recursive: true });
fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules/\n.agents/LOG.md\n.agents/.budget/\n.agents/.loops/\n.agents/.gate/\n');
const g = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' }).trim();
g('init', '-q', '-b', 'main');
g('config', 'user.email', 'bench@example.com');
g('config', 'user.name', 'bench');
g('add', '-A');
g('commit', '-q', '-m', 'base');
process.stdout.write(JSON.stringify({ dir, base: g('rev-parse', 'HEAD') }) + '\n');
