'use strict';
/**
 * Reads the kit's agent definitions (agents/*.md, Claude Code format) and renders them for other
 * tools, so there is one source of truth: Codex (.codex/agents/*.toml), Cursor (.cursor/agents/*.md)
 * and Claude Code without the plugin (.claude/agents/*.md).
 * Where each tool looks for agents changes between versions; see docs/COMPATIBILITY.md.
 */
const fs = require('fs');
const path = require('path');

const AGENTS_DIR = path.resolve(__dirname, '..', '..', 'agents');

function parseAgent(text) {
  text = text.replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (!m) return null;
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = /^([\w-]+):\s*(.*)$/.exec(line);
    if (kv) meta[kv[1]] = kv[2].trim();
  }
  return { meta, body: m[2].trim() };
}

function listAgents() {
  return fs
    .readdirSync(AGENTS_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({ file: f, text: fs.readFileSync(path.join(AGENTS_DIR, f), 'utf8') }))
    .map((a) => ({ file: a.file, text: a.text.replace(/\r\n/g, '\n'), ...parseAgent(a.text) }))
    .filter((a) => a.meta && a.meta.name);
}

const readOnly = (a) => !/\b(Write|Edit)\b/.test(a.meta.tools || '');
// Skills are exported to .agents/skills for tools without the plugin.
const forProject = (s) => s.replace(/\bskills\/([\w-]+)\//g, '.agents/skills/$1/').replace(/`skills\/([\w-]+)\/SKILL\.md`/g, '`.agents/skills/$1/SKILL.md`');
const tomlString = (s) => '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ') + '"';

function toToml(a) {
  const body = forProject(a.body).replace(/\\/g, '\\\\').replace(/"""/g, '\\"\\"\\"');
  return `name = ${tomlString(a.meta.name)}\ndescription = ${tomlString(a.meta.description || '')}\ndeveloper_instructions = """\n${body}\n"""\n`;
}

function toCursor(a) {
  const head = ['---', `name: ${a.meta.name}`, `description: ${a.meta.description || ''}`, 'model: inherit'];
  if (readOnly(a)) head.push('readonly: true');
  return head.join('\n') + '\n---\n\n' + forProject(a.body) + '\n';
}

const toClaude = (a) => a.text;

const TARGETS = {
  codex: { dir: '.codex/agents', ext: '.toml', render: toToml },
  cursor: { dir: '.cursor/agents', ext: '.md', render: toCursor },
  claude: { dir: '.claude/agents', ext: '.md', render: toClaude },
};

/** Files to write for the given tools: [{ rel, text }]. Tools without agent folders are skipped. */
function renderFor(tools) {
  const out = [];
  for (const t of tools) {
    const target = TARGETS[t];
    if (!target) continue;
    for (const a of listAgents()) out.push({ rel: `${target.dir}/${a.meta.name}${target.ext}`, text: target.render(a) });
  }
  return out;
}

module.exports = { parseAgent, listAgents, renderFor, toToml, toCursor, TARGETS };
