#!/usr/bin/env node
'use strict';
/**
 * SubagentStart: ties the agent's id to its spawn, and counts a spawn the human approved after the
 * spawn hook asked (the hook cannot see the answer, so it only notes such a spawn as pending).
 */
const { loadConfig, enabled } = require('../lib/config');
const B = require('../lib/budget');
const { readInput } = require('../lib/hook-io');

function main() {
  const input = readInput();
  const cfg = loadConfig(input.cwd || process.cwd());
  if (cfg.hooksOff) process.exit(0);
  if (!['agent-budget', 'plan-gate', 'machine-check'].some((c) => enabled(cfg, c))) process.exit(0); // nothing counts spawns
  B.withLock(cfg.root, input.session_id, () => {
    const state = B.load(cfg.root, input.session_id);
    if (B.start(state, input.agent_type, input.agent_id)) B.save(cfg.root, input.session_id, state);
  });
}

if (require.main === module) {
  try {
    main();
  } catch (_) {}
  process.exit(0);
}
