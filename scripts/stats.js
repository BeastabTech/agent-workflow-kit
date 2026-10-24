#!/usr/bin/env node
'use strict';
/**
 * Static footprint of the kit, measured on the real files (tokens ~ characters / 4, so treat them as
 * estimates): what every session pays for the kit, and what a new agent reads at cold start with
 * the index versus without it. It cannot measure speed or output quality; for those compare two real
 * sessions with session-stats.js (docs/BENCHMARK.md).
 *
 * Usage: node stats.js [--json]
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { init } = require('./init-project');
const { listAgents } = require('./lib/agents');

const KIT = path.resolve(__dirname, '..');
const tokens = (s) => Math.ceil(s.length / 4);
const read = (f) => fs.readFileSync(f, 'utf8');

function walkMd(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walkMd(p) : p.endsWith('.md') ? [p] : [];
  });
}

function frontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  const meta = {};
  if (m) for (const l of m[1].split(/\r?\n/)) {
    const kv = /^([\w-]+):\s*(.*)$/.exec(l);
    if (kv) meta[kv[1]] = kv[2];
  }
  return meta;
}

function measure() {
  // 1. Always loaded: skill and agent names + descriptions (Claude Code lists them in every session).
  const skillsDir = path.join(KIT, 'skills');
  const skills = fs.readdirSync(skillsDir).filter((n) => fs.existsSync(path.join(skillsDir, n, 'SKILL.md')));
  const skillList = skills.map((n) => {
    const text = read(path.join(skillsDir, n, 'SKILL.md'));
    const meta = frontmatter(text);
    return { name: n, listed: tokens(`${n}: ${meta.description || ''}`), body: tokens(text.replace(/^---[\s\S]*?---/, '')) };
  });
  const agentList = listAgents().map((a) => tokens(`${a.meta.name}: ${a.meta.description || ''}`));
  const alwaysOn = skillList.reduce((n, s) => n + s.listed, 0) + agentList.reduce((n, x) => n + x, 0);

  // 2. Cold start in a freshly initialised project.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'awk-stats-'));
  try {
    init({ target: dir, tools: 'claude' });
    const index = tokens(read(path.join(dir, 'AGENTS.md')));
    const docs = walkMd(path.join(dir, 'docs', 'context')).filter((f) => !/README\.md$/.test(f));
    const rules = walkMd(path.join(dir, '.claude', 'rules'));
    const docTokens = docs.map((f) => tokens(read(f)));
    const allDocs = docTokens.reduce((n, x) => n + x, 0) + rules.reduce((n, f) => n + tokens(read(f)), 0);
    const avgDoc = Math.round(docTokens.reduce((n, x) => n + x, 0) / docTokens.length);
    const biggest = Math.max(...docTokens);
    return {
      skills: skills.length,
      agents: agentList.length,
      alwaysOnTokens: alwaysOn,
      avgSkillBodyTokens: Math.round(skillList.reduce((n, s) => n + s.body, 0) / skillList.length),
      largestSkillBodyTokens: Math.max(...skillList.map((s) => s.body)),
      indexTokens: index,
      contextDocs: docs.length,
      avgDocTokens: avgDoc,
      largestDocTokens: biggest,
      coldStartWithIndex: index + biggest, // index plus the largest single doc (worst case for the index route)
      coldStartReadEverything: index + allDocs,
    };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const k = (n) => `~${(n / 1000).toFixed(1)}k`;

if (require.main === module) {
  const m = measure();
  if (process.argv.includes('--json')) process.stdout.write(JSON.stringify(m, null, 2) + '\n');
  else {
    const saved = Math.round((1 - m.coldStartWithIndex / m.coldStartReadEverything) * 100);
    process.stdout.write(
      [
        '| Measure | Tokens (est.) |',
        '|---|---|',
        `| Always loaded: ${m.skills} skill + ${m.agents} agent descriptions | ${k(m.alwaysOnTokens)} |`,
        `| One skill body, loaded only when it is used (average / largest) | ${k(m.avgSkillBodyTokens)} / ${k(m.largestSkillBodyTokens)} |`,
        `| \`AGENTS.md\` index in a new project | ${k(m.indexTokens)} |`,
        `| Cold start, index + the largest single context doc | ${k(m.coldStartWithIndex)} |`,
        `| Cold start, reading all ${m.contextDocs} context docs and rules instead | ${k(m.coldStartReadEverything)} |`,
        `| Cold start saved by reading the index first (worst case) | ${saved}% |`,
        '',
        'Tokens = characters / 4. This is the template text of a fresh project; real projects have longer docs, so the saving grows.',
      ].join('\n') + '\n',
    );
  }
}

module.exports = { measure };
