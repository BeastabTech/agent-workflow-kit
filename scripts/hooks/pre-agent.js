#!/usr/bin/env node
'use strict';
/**
 * PreToolUse guard for the Agent (Task) tool: counts sub-agent spawns and warns before there are
 * too many, too many at once, more than the machine's free memory and CPU can take, or a brief
 * that is too big. A worker started before the user approved a plan (.agents/PLAN.md) asks the
 * human. Crossing a limit asks the human; everything else is a warning the manager passes on.
 * Any internal error lets the spawn through.
 */
const fs = require('fs');
const path = require('path');
const { loadConfig, enabled, sharedRoot } = require('../lib/config');
const B = require('../lib/budget');
const { readInput, respondPreToolUse } = require('../lib/hook-io');

/** Tracked file count, or -1 when unknown (not a git repo, git missing). */
function trackedFiles(root) {
  try {
    const out = require('child_process').execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
    return out.split('\n').filter(Boolean).length;
  } catch (_) {
    return -1;
  }
}

// Agents that only read, plan or review (any prefix, hyphenated names included); anything else is a worker that changes things.
const READ_ONLY = /(^|[:-])(explorer|planner|reviewer|explore|plan|guide|architect|analyzer)$/i;

/** True when .agents/PLAN.md in this checkout or the main checkout says `Status: approved` (written only after the user's yes). */
function planApproved(cfg, cwd) {
  for (const root of new Set([cfg.root, sharedRoot(cwd)])) {
    try {
      if (/^\s*Status:\s*approved\b/im.test(fs.readFileSync(path.join(root, '.agents', 'PLAN.md'), 'utf8'))) return true;
    } catch (_) {}
  }
  return false;
}

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
  const findings = [];
  const type = String(ti.subagent_type || 'general-purpose');
  const cwd = input.cwd || process.cwd();
  // Count the spawn only when it goes through without a question: a declined spawn never gets a
  // SubagentStop, and a phantom "running" agent would make every later check ask too early.
  const commit = () => {
    if (findings.some((f) => f.level === 'ask') || verdict.level === 'ask') return;
    B.record(state, { type, model: ti.model || 'inherit', name: String(ti.description || '').slice(0, 60), est: verdict.nextEst, hash: next.hash });
    try {
      B.save(cfg.root, sid, state);
    } catch (_) {}
  };
  if (enabled(cfg, 'plan-gate') && cfg.planGate && cfg.hasTeamConfig && !READ_ONLY.test(type) && !planApproved(cfg, cwd)) {
    findings.push({ level: 'ask', check: 'plan-gate', reason: `A worker agent (${type}) is about to start, but .agents/PLAN.md has no "Status: approved". Talk to the user first (discover skill): what they want, the approach, the task split and how many agents; write the plan and set Status: approved only after their yes. Read-only helpers (explorer, planner, reviewer) do not need it.` });
  }
  let m = null;
  try {
    m = B.machine(limits);
  } catch (_) {}
  // limitedBy 'limit' means the cap is maxParallel itself, which the budget check below already asks about.
  if (m && enabled(cfg, 'machine-check') && m.fit.limitedBy !== 'limit') {
    const running = B.summary(state, limits).active + 1; // plus this spawn
    if (m.fit.pressure === 'high' && running > 1) {
      findings.push({ level: 'ask', check: 'machine-check', reason: `${m.text} This would be agent ${running} running at once. Wait for one to finish or do the work yourself.` });
    } else if (running > m.fit.parallel) {
      findings.push({ level: 'ask', check: 'machine-check', reason: `This would be agent ${running} running at once; this machine can take ${m.fit.parallel} now. ${m.text} Start it after one finishes.` });
    } else if (m.fit.pressure === 'high') {
      findings.push({ level: 'warn', check: 'machine-check', reason: `${m.text} Keep to this one agent until memory or CPU frees up.` });
    }
  }
  if (/(^|:)explorer$/.test(String(ti.subagent_type || '')) && limits.smallRepoFiles > 0) {
    const n = trackedFiles(cfg.root);
    if (n >= 0 && n < limits.smallRepoFiles) {
      findings.push({ level: cfg.profile === 'strict' ? 'ask' : 'warn', check: 'agent-budget', reason: `This repo has ${n} tracked files (under ${limits.smallRepoFiles}). A search here is small enough for git grep; in a measured run an explorer sub-agent cost about 6.7 times the tokens and 4 times the time with no saving in the main context. Do the search yourself unless it needs dozens of file reads.` });
    }
  }
  if (verdict.level !== 'ok') {
    const sum = B.summary(state, limits);
    const tail = ` (started ${sum.total + 1}, running ${sum.active + 1}, ~${Math.round((sum.estTokens + verdict.nextEst) / 1000)}k tokens estimated). Tell the user before spawning more: \`node .agents/tools/budget.js status\`.`;
    findings.push({ level: verdict.level === 'ask' || cfg.profile === 'strict' ? 'ask' : 'warn', check: 'agent-budget', reason: verdict.messages.join(' ') + tail });
  }
  commit();
  respondPreToolUse(findings);
}

if (require.main === module) {
  try {
    main();
  } catch (_) {
    process.exit(0);
  }
}
