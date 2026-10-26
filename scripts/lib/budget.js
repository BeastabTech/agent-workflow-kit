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
  maxLoopRounds: 8, // rounds of one loop (fix until green, review and fix) before it must stop
  stuckRepeats: 2, // the same failure this many rounds in a row ends a loop
  smallRepoFiles: 400, // an explorer in a repo with fewer tracked files is a net loss: warn (0 = never)
  machineCheck: 1, // 1 = cap parallel agents by free memory and CPU load (resources.js); 0 = off
  agentMemMB: 600, // memory one running agent or session needs, tools and test runs included
  memReserveMB: 2048, // memory always left for the OS and the user's apps (at least 15% of RAM)
  cpuPerAgent: 1, // idle CPU cores one running agent needs
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

/** Machine reading and safe parallel count, or null when the check is off. AWK_MACHINE=off disables it; a JSON value fakes the reading (tests). */
function machine(limits) {
  const env = String(process.env.AWK_MACHINE || '').trim();
  if (!limits.machineCheck || /^(off|0|false)$/i.test(env)) return null;
  const R = require('./resources');
  let fake = null;
  if (env.startsWith('{')) {
    try {
      fake = JSON.parse(env);
    } catch (_) {}
  }
  const snap = R.snapshot(fake);
  const fit = R.safeParallel(snap, limits);
  return { snap, fit, text: R.describe(snap, fit) };
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
  const m = p.machine;
  if (m && m.fit.pressure === 'high') warnings.push('The machine is under pressure: run nothing in parallel, work solo or one agent at a time.');
  else if (m && parallel > m.fit.parallel) warnings.push(`${parallel} at once is more than this machine can take now (${m.fit.parallel}, limited by ${m.fit.limitedBy}). Run in waves of ${m.fit.parallel}.`);
  return { agents, parallel, briefChars, estTokens: est, warnings, limits, safeParallel: m ? m.fit.parallel : null };
}

const TIERS = { small: 'small/fast model (haiku)', mid: 'mid model (sonnet)', strong: 'strong model (opus)' };

/**
 * Size the problem first, then pick mode, model tier and agent count. Inputs (all numbers or words):
 * files = files to change, read = files to read or search, parts = independent parts,
 * risk = none | high (auth, payments, data, deletes, migrations). The preset shifts the result.
 */
function triage(t, preset) {
  let name = preset || 'normal';
  const auto = name === 'auto';
  if (auto) name = 'normal'; // refined below once the size is known
  const files = Math.max(0, Number(t.files) || 0);
  const read = Math.max(0, Number(t.read) || 0);
  const parts = Math.max(1, Number(t.parts) || 1);
  const high = /^(high|yes|true)$/i.test(String(t.risk || ''));
  let size = files <= 3 && read <= 8 && parts <= 1 ? 'S' : files <= 8 && read <= 30 && parts <= 2 ? 'M' : parts >= 3 && files > 8 ? 'XL' : 'L';
  if (high && size === 'S') size = 'M';
  if (auto) name = high || size === 'L' || size === 'XL' ? 'best' : size === 'S' ? 'low-tokens' : 'normal';
  let mode;
  let agents = 0;
  let model = size === 'S' ? 'small' : size === 'M' ? 'mid' : 'mid';
  const notes = [];
  if (name === 'low-tokens' && (size === 'L' || size === 'XL')) {
    mode = '2 workers at most on separate files, you plan it yourself, no closer';
    agents = 2;
    notes.push('Cheapest edition: work in waves, keep briefs and reports short, hand off when the context fills.');
  } else if (name === 'lite' || name === 'low-tokens') {
    mode = 'solo';
    if (size === 'L' || size === 'XL') notes.push('Large problem, but this edition stays solo: work in steps and hand off (handoff skill) when the context fills.');
  } else if (size === 'S') {
    mode = 'solo';
  } else if (size === 'M') {
    mode = read > 15 ? 'one helper (explorer for the reading, you edit)' : 'solo';
    agents = read > 15 ? 1 : 0;
  } else {
    mode = size === 'L' ? `${Math.min(parts, 4)} workers on separate files` : 'planner first, then workers on separate files, then closer';
    agents = size === 'L' ? Math.min(parts, 4) : Math.min(parts, 4) + 1;
    model = 'mid';
    notes.push('Strong model only for design and the risky parts; mid for well-specified workers; small for reading and docs.');
  }
  const review = high || name === 'best' ? (size === 'S' && !high ? 'self-review only' : 'independent reviewer' + (high ? ' (security-reviewer for auth, payments, data)' : '')) : size === 'S' ? 'self-review' : 'self-review, reviewer if the change is cross-cutting';
  if (review.startsWith('independent')) agents += 1;
  if (name === 'low-tokens' && model === 'mid' && size === 'M') model = 'small';
  if (name === 'best' && size !== 'S') model = 'strong';
  if (high && model === 'small') model = 'mid';
  return { size, mode, agents, model: TIERS[model], review, preset: auto ? 'auto' : name, notes };
}

module.exports = { machine, triage, DEFAULT_LIMITS, limitsFrom, stateFile, load, save, promptHash, estTokens, summary, evaluate, record, finish, plan, safeId };
