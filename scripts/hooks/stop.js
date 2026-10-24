#!/usr/bin/env node
'use strict';
/**
 * Stop: the done gate. When the agent is about to stop after changing code, checks from the
 * transcript that it ran the tests after its last edit (and, in the `best` edition, that it
 * added or updated a test). If not, blocks the stop once or twice with the specific reason, so the
 * agent keeps working. Capped per session, so it can never loop. Fails open on any error.
 */
const fs = require('fs');
const path = require('path');
const { loadConfig, enabled } = require('../lib/config');
const presets = require('../lib/presets');
const { analyse, problems } = require('../lib/done-gate');
const { readInput } = require('../lib/hook-io');

function main() {
  const input = readInput();
  if (!input.transcript_path || !fs.existsSync(input.transcript_path)) process.exit(0);
  const cfg = loadConfig(input.cwd || process.cwd());
  if (cfg.hooksOff || !enabled(cfg, 'done-gate')) process.exit(0);
  const gate = (cfg.gate !== undefined ? cfg.gate : presets.get(cfg.preset).gate) || {};
  if (!gate.maxBlocks) process.exit(0);
  const testCmd = cfg.commands && cfg.commands.test && !/^</.test(cfg.commands.test) ? cfg.commands.test : '';
  const found = problems(analyse(input.transcript_path, testCmd ? [testCmd] : []), gate, testCmd);
  if (!found.length) process.exit(0);
  const file = path.join(cfg.root, '.agents', '.gate', `${String(input.session_id || 'default').replace(/[^\w.-]/g, '_').slice(0, 80)}.json`);
  let n = 0;
  try {
    n = JSON.parse(fs.readFileSync(file, 'utf8')).blocks || 0;
  } catch (_) {}
  if (n >= gate.maxBlocks) process.exit(0);
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ blocks: n + 1 }));
  } catch (_) {}
  process.stdout.write(JSON.stringify({ decision: 'block', reason: `[done-gate] ${found.join(' ')}` }));
}

if (require.main === module) {
  try {
    main();
  } catch (_) {}
  process.exit(0);
}
