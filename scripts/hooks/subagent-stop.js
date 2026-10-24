#!/usr/bin/env node
'use strict';
/** SubagentStop: marks one running sub-agent as finished so the parallel count stays right. */
const { loadConfig } = require('../lib/config');
const B = require('../lib/budget');
const { readInput } = require('../lib/hook-io');

function main() {
  const input = readInput();
  const cfg = loadConfig(input.cwd || process.cwd());
  if (cfg.hooksOff) process.exit(0);
  const state = B.load(cfg.root, input.session_id);
  if (B.finish(state, input.agent_type)) B.save(cfg.root, input.session_id, state);
}

if (require.main === module) {
  try {
    main();
  } catch (_) {}
  process.exit(0);
}
