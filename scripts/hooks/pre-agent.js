#!/usr/bin/env node
'use strict';
/**
 * PreToolUse guard for the Agent (Task) tool: counts sub-agent spawns and warns before there are
 * too many, too many at once, or a brief that is too big. Crossing a limit asks the human;
 * everything else is a warning the manager passes on. Any internal error lets the spawn through.
 */
const { loadConfig, enabled } = require('../lib/config');
const B = require('../lib/budget');
const { readInput, respondPreToolUse } = require('../lib/hook-io');

function main() {
  const input = readInput();
  if (!input.tool_input) process.exit(0); // broken or empty input: do not count it
  const ti = input.tool_input;
  const cfg = loadConfig(input.cwd || process.cwd());
  if (cfg.hooksOff || !enabled(cfg, 'agent-budget')) process.exit(0);
  const limits = B.limitsFrom(cfg);
  const sid = input.session_id;
  const state = B.load(cfg.root, sid);
  const prompt = String(ti.prompt || '');
  const next = { promptChars: prompt.length, hash: B.promptHash(prompt) };
  const verdict = B.evaluate(state, limits, next);
  B.record(state, { type: ti.subagent_type || 'general-purpose', model: ti.model || 'inherit', name: String(ti.description || '').slice(0, 60), est: verdict.nextEst, hash: next.hash });
  try {
    B.save(cfg.root, sid, state);
  } catch (_) {}
  if (verdict.level === 'ok') process.exit(0);
  const sum = B.summary(state, limits);
  const tail = ` (started ${sum.total}, running ${sum.active}, ~${Math.round(sum.estTokens / 1000)}k tokens estimated). Tell the user before spawning more: \`node .agents/tools/budget.js status\`.`;
  respondPreToolUse([{ level: verdict.level === 'ask' || cfg.profile === 'strict' ? 'ask' : 'warn', check: 'agent-budget', reason: verdict.messages.join(' ') + tail }]);
}

if (require.main === module) {
  try {
    main();
  } catch (_) {
    process.exit(0);
  }
}
