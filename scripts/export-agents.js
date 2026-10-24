#!/usr/bin/env node
'use strict';
/**
 * Copies the kit's agents (planner, closer, reviewer, ...) into a project in the format each tool reads.
 * Never overwrites an existing file unless --force. Claude Code users with the plugin do not need this.
 *
 * Usage: node export-agents.js --target <dir> [--to codex,cursor,claude] [--force] [--dry-run]
 */
const fs = require('fs');
const path = require('path');
const { renderFor, TARGETS } = require('./lib/agents');

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[argv[i].slice(2)] = true;
    else out[argv[i].slice(2)] = argv[++i];
  }
  return out;
}

function exportAgents(opts) {
  const target = path.resolve(opts.target || '.');
  const tools = String(opts.to || 'codex,cursor').split(',').map((s) => s.trim()).filter(Boolean);
  const unknown = tools.filter((t) => !TARGETS[t]);
  if (unknown.length) throw new Error(`Unknown --to value(s): ${unknown.join(', ')}. Use: ${Object.keys(TARGETS).join(', ')}`);
  const report = { target, written: [], kept: [] };
  for (const { rel, text } of renderFor(tools)) {
    const dest = path.join(target, rel);
    if (fs.existsSync(dest) && !opts.force) {
      report.kept.push(rel);
      continue;
    }
    if (!opts['dry-run']) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, text);
    }
    report.written.push(rel);
  }
  return report;
}

if (require.main === module) {
  const opts = args(process.argv.slice(2));
  if (opts.help || !opts.target) {
    process.stdout.write('Usage: node export-agents.js --target <dir> [--to codex,cursor,claude] [--force] [--dry-run]\n');
    process.exit(opts.help ? 0 : 1);
  }
  try {
    process.stdout.write(JSON.stringify(exportAgents(opts), null, 2) + '\n');
  } catch (e) {
    process.stderr.write(`export-agents.js: ${e.message}\n`);
    process.exit(1);
  }
}

module.exports = { exportAgents };
