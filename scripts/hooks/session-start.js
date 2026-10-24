#!/usr/bin/env node
'use strict';
/**
 * SessionStart: tells the agent where the project's hand-off and state files are,
 * plus the personal reply style. Silent in projects without .agents/.
 */
const fs = require('fs');
const path = require('path');
const { loadConfig, sharedRoot } = require('../lib/config');
const { readInput } = require('../lib/hook-io');
const { limitsFrom } = require('../lib/budget');
const presets = require('../lib/presets');

const STYLES = {
  'caveman-lite': 'Reply style (personal setting): terse. Drop filler, pleasantries and hedging; keep full sentences, exact code, paths and numbers.',
  'caveman-full': 'Reply style (personal setting): caveman. Fragments are fine, no articles or filler, keep exact code, paths, numbers and warnings. Use normal prose for security warnings and irreversible steps.',
};

function ageText(ms) {
  const h = Math.round(ms / 36e5);
  return h < 1 ? 'less than an hour ago' : h < 48 ? `${h} hours ago` : `${Math.round(h / 24)} days ago`;
}

function main() {
  const input = readInput();
  const cwd = input.cwd || process.cwd();
  const cfg = loadConfig(cwd);
  if (cfg.hooksOff) process.exit(0);
  const notes = [];
  const directive = presets.get(cfg.preset).directive;
  if (directive) notes.push(directive);
  if (STYLES[cfg.personal.replyStyle]) notes.push(STYLES[cfg.personal.replyStyle]);
  if (input.source === 'compact') {
    notes.push('The conversation was just compacted. Do not re-read whole files or re-run searches you already summarised; re-open only what the next step needs. In a kit project, re-read .agents/HANDOFF.md and your rows in .agents/STATE.md first.');
  }

  const agentsDir = path.join(cfg.root, '.agents');
  if (fs.existsSync(agentsDir)) {
    notes.push(`This project uses the agent workflow kit. Work mode: ${cfg.workMode}. Index: AGENTS.md. State: .agents/STATE.md.`);
    const lim = limitsFrom(cfg);
    notes.push(`Sub-agent limits: ${lim.maxParallel} at once, ${lim.maxSpawns} per session. Check a plan with: node .agents/tools/budget.js plan --agents <n>. Use the delegate skill; warn the user before spawning many.`);
    const handoff = path.join(agentsDir, 'HANDOFF.md');
    try {
      const st = fs.statSync(handoff);
      const body = fs.readFileSync(handoff, 'utf8');
      if (/\S/.test(body.replace(/<!--[\s\S]*?-->/g, '').replace(/^#.*$/gm, ''))) {
        notes.push(`A hand-off note exists at .agents/HANDOFF.md (updated ${ageText(Date.now() - st.mtimeMs)}). Read it before starting work.`);
      }
    } catch (_) {}
    const log = path.join(sharedRoot(cwd), '.agents', 'LOG.md');
    try {
      const text = fs.readFileSync(log, 'utf8');
      const since = Date.now() - 24 * 36e5;
      const recent = (text.match(/^### (\S+)/gm) || []).filter((h) => Date.parse(h.slice(4)) > since).length;
      if (recent) notes.push(`${recent} agent message(s) in .agents/LOG.md in the last 24 hours. Check your inbox: node .agents/tools/msg.js inbox --for <your-name>.`);
    } catch (_) {}
  }
  if (!notes.length) process.exit(0);
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: notes.join('\n') } }));
}

if (require.main === module) {
  try {
    main();
  } catch (_) {
    process.exit(0);
  }
}
