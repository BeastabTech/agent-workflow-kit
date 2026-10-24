#!/usr/bin/env node
'use strict';
/**
 * Spawn budget CLI for managers (copied to .agents/tools/budget.js by init).
 *
 *   budget.js limits                                         show the limits in force
 *   budget.js plan --agents 6 [--parallel 3] [--brief-chars 2000]
 *                                                            check a plan BEFORE spawning; prints warnings
 *   budget.js status [--session <id>]                        agents started, running, estimated tokens
 *
 * Limits come from "limits" in .agents/config.json. Token numbers are estimates.
 */
const fs = require('fs');
const path = require('path');
const { loadConfig } = require('./lib/config');
const B = require('./lib/budget');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const k = argv[i].slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[k] = true;
    else out[k] = argv[++i];
  }
  return out;
}

function latestSession(root) {
  const dir = path.join(root, '.agents', '.budget');
  try {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }));
    files.sort((a, b) => b.t - a.t);
    return files.length ? files[0].f.replace(/\.json$/, '') : null;
  } catch (_) {
    return null;
  }
}

const k = (n) => `~${Math.round(n / 1000)}k`;

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const a = parseArgs(rest);
  const cfg = loadConfig(process.cwd());
  const limits = B.limitsFrom(cfg);
  const out = (s) => process.stdout.write(s + '\n');
  if (cmd === 'limits') {
    out(Object.entries(limits).map(([key, v]) => `${key}: ${v}`).join('\n'));
  } else if (cmd === 'plan') {
    const p = B.plan(limits, { agents: a.agents, parallel: a.parallel, briefChars: a.briefChars });
    out(`Plan: ${p.agents} agent(s), ${p.parallel} at once, ${k(p.estTokens)} tokens estimated (assumes ${k(limits.assumedAgentTokens)} per agent).`);
    out(p.warnings.length ? p.warnings.map((w) => `WARNING: ${w}`).join('\n') + '\nShow these to the user before spawning.' : 'Within limits.');
  } else if (cmd === 'status') {
    const sid = a.session && a.session !== true ? a.session : latestSession(cfg.root);
    const state = sid ? B.load(cfg.root, sid) : { spawns: [] };
    const s = B.summary(state, limits);
    out(`Session ${sid || '(none yet)'}: ${s.total} started (limit ${limits.maxSpawns}), ${s.active} running (limit ${limits.maxParallel}), ${k(s.estTokens)} tokens estimated${limits.tokenBudget ? ` of ${k(limits.tokenBudget)}` : ''}.`);
    for (const x of state.spawns) out(`- ${x.done ? 'done   ' : 'running'} ${x.type} · ${x.model} · ${x.name || '(no description)'} · ${k(x.est || 0)}`);
  } else {
    out(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^#!.*\n'use strict';\n\/\*\*/, '') + '*/');
    process.exitCode = cmd ? 1 : 0;
  }
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    process.stderr.write(`budget.js: ${e.message}\n`);
    process.exit(1);
  }
}
