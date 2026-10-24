'use strict';
/** Shared stdin/stdout helpers for PreToolUse and SessionStart hooks. */
function readInput() {
  try {
    const raw = require('fs').readFileSync(0, 'utf8');
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

/**
 * findings: [{ level: 'deny'|'ask'|'warn', check, reason }]
 * deny wins over ask; warn only adds context for the agent.
 */
function respondPreToolUse(findings) {
  const deny = findings.filter((f) => f.level === 'deny');
  const ask = findings.filter((f) => f.level === 'ask');
  const warn = findings.filter((f) => f.level === 'warn');
  const fmt = (list) => list.map((f) => `[${f.check}] ${f.reason}`).join('\n');
  let out = null;
  if (deny.length) {
    out = { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: fmt(deny) } };
  } else if (ask.length) {
    out = { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: fmt(ask) } };
  } else if (warn.length) {
    out = { hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: fmt(warn) } };
  }
  if (out) process.stdout.write(JSON.stringify(out));
  process.exit(0);
}

module.exports = { readInput, respondPreToolUse };
