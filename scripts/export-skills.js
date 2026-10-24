#!/usr/bin/env node
'use strict';
/**
 * Copies the kit's skills (SKILL.md folders, Agent Skills format) into a project
 * so agents other than Claude Code can use them.
 * Never overwrites an existing skill folder unless --force.
 *
 * Usage: node export-skills.js --target <dir> [--to agents,codex,cursor,gemini,claude] [--skills a,b] [--force] [--dry-run]
 */
const fs = require('fs');
const path = require('path');

const KIT = path.resolve(__dirname, '..');
const SKILLS = path.join(KIT, 'skills');
const DESTS = {
  agents: '.agents/skills',
  claude: '.claude/skills',
  codex: '.codex/skills',
  cursor: '.cursor/skills',
  gemini: '.gemini/skills',
};
// Skills that drive the kit's own scripts; they only make sense with the plugin installed.
const PLUGIN_ONLY = ['init'];

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[argv[i].slice(2)] = true;
    else out[argv[i].slice(2)] = argv[++i];
  }
  return out;
}

function copyDir(src, dest, rewrite) {
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) copyDir(s, d, rewrite);
    else if (e.name.endsWith('.md')) fs.writeFileSync(d, rewrite(fs.readFileSync(s, 'utf8')));
    else fs.copyFileSync(s, d);
  }
}

function exportSkills(opts) {
  const target = path.resolve(opts.target || '.');
  const tools = String(opts.to || 'agents').split(',').map((s) => s.trim()).filter(Boolean);
  const unknown = tools.filter((t) => !DESTS[t]);
  if (unknown.length) throw new Error(`Unknown --to value(s): ${unknown.join(', ')}. Use: ${Object.keys(DESTS).join(', ')}`);
  const all = fs.readdirSync(SKILLS).filter((n) => fs.existsSync(path.join(SKILLS, n, 'SKILL.md')));
  const wanted = opts.skills ? String(opts.skills).split(',').map((s) => s.trim()) : all.filter((n) => !PLUGIN_ONLY.includes(n));
  const report = { target, written: [], kept: [], missing: wanted.filter((n) => !all.includes(n)) };

  for (const tool of tools) {
    const base = DESTS[tool];
    for (const name of wanted.filter((n) => all.includes(n))) {
      const rel = `${base}/${name}`;
      const dest = path.join(target, rel);
      if (fs.existsSync(dest) && !opts.force) {
        report.kept.push(rel);
        continue;
      }
      // Paths into the plugin become paths into the exported copy.
      const rewrite = (text) => text.split('${CLAUDE_PLUGIN_ROOT}/skills/').join(`${base}/`);
      if (!opts['dry-run']) {
        fs.rmSync(dest, { recursive: true, force: true });
        copyDir(path.join(SKILLS, name), dest, rewrite);
      }
      report.written.push(rel);
    }
  }
  return report;
}

if (require.main === module) {
  const opts = args(process.argv.slice(2));
  if (opts.help || !opts.target) {
    process.stdout.write('Usage: node export-skills.js --target <dir> [--to agents,codex,cursor,gemini,claude] [--skills a,b] [--force] [--dry-run]\n');
    process.exit(opts.help ? 0 : 1);
  }
  try {
    process.stdout.write(JSON.stringify(exportSkills(opts), null, 2) + '\n');
  } catch (e) {
    process.stderr.write(e.message + '\n');
    process.exit(1);
  }
}

module.exports = { exportSkills, DESTS };
