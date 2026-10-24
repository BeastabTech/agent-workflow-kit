'use strict';
/**
 * Spawn budget: counts the sub-agents a session starts and warns before there are too many,
 * too many at once, or too much context is handed to them. Token numbers are ESTIMATES
 * (an assumed size per agent plus prompt length / 4); they are for early warning, not billing.
 *
 * State lives in <project>/.agents/.budget/<session>.json (gitignored, local to one machine).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_LIMITS = {
  maxParallel: 4, // sub-agents running at the same time
  maxSpawns: 10, // sub-agents started in one session
  warnAtPct: 70, // warn from this share of a limit
  assumedAgentTokens: 30000, // rough tokens one sub-agent run costs
  tokenBudget: 0, // estimated tokens for all sub-agents; 0 = no limit
  maxPromptChars: 6000, // brief size that starts to cost real context
  maxFixRounds: 2, // used by the closer and reviewers (text rules only)
};

function limitsFrom(cfg) {
  const out = { ...DEFAULT_LIMITS };
  const user = (cfg && cfg.limits) || {};
  for (const k of Object.keys(DEFAULT_LIMITS)) {
    const v = Number(user[k]);
    if (user[k] !== undefined && Number.isFinite(v) && v >= 0) out[k] = v;
  }
  return out;
}

function safeId(id) {
  return String(id || 'default').replace(/[^\w.-]/g, '_').slice(0, 80) || 'default';
}

function stateFile(root, sessionId) {
  return path.join(root, '.agents', '.budget', `${safeId(sessionId)}.json`);
}

function load(root, sessionId) {
  try {
    const s = JSON.parse(fs.readFileSync(stateFile(root, sessionId), 'utf8'));
    return Array.isArray(s.spawns) ? s : { spawns: [] };
  } catch (_) {
    return { spawns: [] };
  }
}

function save(root, sessionId, state) {
  const file = stateFile(root, sessionId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(state));
}

const promptHash = (p) => crypto.createHash('sha1').update(String(p || '').trim().toLowerCase()).digest('hex').slice(0, 10);
const estTokens = (chars) => Math.ceil(chars / 4);

function summary(state, limits) {
  const spawns = state.spawns;
  const active = spawns.filter((s) => !s.done);
  const est = spawns.reduce((n, s) => n + (s.est || 0), 0);
  return { total: spawns.length, active: active.length, estTokens: est, limits };
}

/**
 * Judge the next spawn. Returns { level: 'ok' | 'warn' | 'ask', messages: [...] }.
 * 'ask' means a human should decide (a limit would be crossed); 'warn' is a heads-up.
 */
function evaluate(state, limits, next) {
  const s = summary(state, limits);
  const msgs = [];
  let level = 'ok';
  const raise = (l, m) => {
    msgs.push(m);
    if (l === 'ask') level = 'ask';
    else if (level === 'ok') level = 'warn';
  };
  const pct = limits.warnAtPct / 100;
  const nextTotal = s.total + 1;
  const nextActive = s.active + 1;
  const promptChars = (next && next.promptChars) || 0;
  const nextEst = limits.assumedAgentTokens + estTokens(promptChars);

  if (limits.maxParallel && nextActive > limits.maxParallel) {
    raise('ask', `This would be agent ${nextActive} running at once (limit ${limits.maxParallel}). Wait for one to finish, or raise limits.maxParallel in .agents/config.json.`);
  } else if (limits.maxParallel && nextActive >= Math.ceil(limits.maxParallel * pct) && nextActive > 1) {
    raise('warn', `${nextActive} of ${limits.maxParallel} parallel agents would be running.`);
  }
  if (limits.maxSpawns && nextTotal > limits.maxSpawns) {
    raise('ask', `This would be sub-agent ${nextTotal} this session (limit ${limits.maxSpawns}). Check that earlier agents' results are used, or raise limits.maxSpawns.`);
  } else if (limits.maxSpawns && nextTotal >= Math.ceil(limits.maxSpawns * pct)) {
    raise('warn', `Sub-agent ${nextTotal} of ${limits.maxSpawns} this session.`);
  }
  if (limits.tokenBudget) {
    const after = s.estTokens + nextEst;
    if (after > limits.tokenBudget) raise('ask', `Estimated sub-agent tokens would reach ~${Math.round(after / 1000)}k (budget ${Math.round(limits.tokenBudget / 1000)}k).`);
    else if (after >= limits.tokenBudget * pct) raise('warn', `Estimated sub-agent tokens ~${Math.round(after / 1000)}k of ${Math.round(limits.tokenBudget / 1000)}k budget.`);
  }
  if (limits.maxPromptChars && promptChars > limits.maxPromptChars) {
    raise('warn', `The brief is ${promptChars} characters (~${estTokens(promptChars)} tokens). Point to files and docs instead of pasting them; a sub-agent can read them itself.`);
  }
  if (next && next.hash && state.spawns.some((x) => x.hash === next.hash)) {
    raise('warn', 'An agent with the same brief was already started this session. Reuse its result instead of repeating the work.');
  }
  return { level, messages: msgs, nextEst };
}

function record(state, entry) {
  state.spawns.push({ t: new Date().toISOString(), done: false, ...entry });
  return state;
}

/** Mark the oldest running agent of this type (or the oldest running one) as finished. */
function finish(state, type) {
  const running = state.spawns.filter((x) => !x.done);
  const hit = running.find((x) => type && x.type === type) || running[0];
  if (hit) hit.done = new Date().toISOString();
  return Boolean(hit);
}

/** Preflight for the manager: plan before spawning anything. */
function plan(limits, p) {
  const agents = Math.max(0, Number(p.agents) || 0);
  const parallel = Math.max(1, Number(p.parallel) || agents || 1);
  const briefChars = Math.max(0, Number(p.briefChars) || 0);
  const est = agents * (limits.assumedAgentTokens + estTokens(briefChars));
  const warnings = [];
  if (limits.maxSpawns && agents > limits.maxSpawns) warnings.push(`${agents} agents is over the session limit of ${limits.maxSpawns}. Merge tasks or ask the user to raise limits.maxSpawns.`);
  else if (limits.maxSpawns && agents >= Math.ceil(limits.maxSpawns * (limits.warnAtPct / 100))) warnings.push(`${agents} agents uses most of the session limit (${limits.maxSpawns}). Leave room for reviews and the closer.`);
  if (limits.maxParallel && parallel > limits.maxParallel) warnings.push(`${parallel} at once is over the parallel limit of ${limits.maxParallel}. Run in waves.`);
  if (limits.tokenBudget && est > limits.tokenBudget) warnings.push(`Estimated ~${Math.round(est / 1000)}k tokens is over the budget of ${Math.round(limits.tokenBudget / 1000)}k.`);
  if (agents > 1 && parallel === 1) warnings.push('Agents run one after another: check that they really depend on each other, otherwise run them in parallel.');
  return { agents, parallel, briefChars, estTokens: est, warnings, limits };
}

module.exports = { DEFAULT_LIMITS, limitsFrom, stateFile, load, save, promptHash, estTokens, summary, evaluate, record, finish, plan, safeId };
