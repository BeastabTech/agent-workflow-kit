#!/usr/bin/env node
'use strict';
/**
 * Measures one Claude Code session from its transcript: tokens in the main conversation vs in
 * sub-agents, the largest context the main conversation reached, and how many sub-agents ran.
 * Use it to compare the same task done with and without the kit (see docs/BENCHMARK.md).
 *
 * Usage: node session-stats.js <session.jsonl> [--json]
 *        node session-stats.js --latest [--project <dir>] [--json]     newest session of a project
 * Sub-agent transcripts are read from <session>/subagents/*.jsonl next to the session file.
 * Numbers come from the usage fields Claude Code records. Nothing is estimated here.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

function readLines(file) {
  const out = [];
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line));
    } catch (_) {}
  }
  return out;
}

/** Usage of one transcript file. A request can be logged more than once while streaming: keep the last. */
function measure(file) {
  const byRequest = new Map();
  let n = 0;
  for (const o of readLines(file)) {
    if (o.type !== 'assistant' || !o.message || !o.message.usage) continue;
    byRequest.set(o.requestId || o.uuid || `n${n++}`, o.message.usage);
  }
  const t = { turns: byRequest.size, input: 0, cacheWrite: 0, cacheRead: 0, output: 0, peakContext: 0 };
  for (const u of byRequest.values()) {
    const i = u.input_tokens || 0;
    const w = u.cache_creation_input_tokens || 0;
    const r = u.cache_read_input_tokens || 0;
    t.input += i;
    t.cacheWrite += w;
    t.cacheRead += r;
    t.output += u.output_tokens || 0;
    t.peakContext = Math.max(t.peakContext, i + w + r);
  }
  return t;
}

const sum = (list, k) => list.reduce((n, x) => n + x[k], 0);

function sessionStats(file) {
  const main = measure(file);
  const dir = path.join(path.dirname(file), path.basename(file, '.jsonl'), 'subagents');
  let subFiles = [];
  try {
    subFiles = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl')).map((f) => path.join(dir, f));
  } catch (_) {}
  const subs = subFiles.map(measure);
  const sub = {
    count: subs.length,
    turns: sum(subs, 'turns'),
    input: sum(subs, 'input'),
    cacheWrite: sum(subs, 'cacheWrite'),
    cacheRead: sum(subs, 'cacheRead'),
    output: sum(subs, 'output'),
    peakContext: subs.reduce((m, x) => Math.max(m, x.peakContext), 0),
  };
  // "Fresh" tokens = input + cache writes + output. Cache reads are re-reads of context already paid for.
  const fresh = (x) => x.input + x.cacheWrite + x.output;
  return { file, main, sub, freshMain: fresh(main), freshSub: fresh(sub), freshTotal: fresh(main) + fresh(sub) };
}

function latest(projectDir) {
  const abs = path.resolve(projectDir || process.cwd());
  const slug = abs.replace(/[^a-zA-Z0-9]/g, '-');
  const base = path.join(os.homedir(), '.claude', 'projects');
  const candidates = [slug, fs.existsSync(base) ? fs.readdirSync(base).find((d) => d.toLowerCase() === slug.toLowerCase()) : null].filter(Boolean);
  for (const c of candidates) {
    const dir = path.join(base, c);
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl')).map((f) => ({ f: path.join(dir, f), t: fs.statSync(path.join(dir, f)).mtimeMs }));
    files.sort((a, b) => b.t - a.t);
    if (files.length) return files[0].f;
  }
  return null;
}

const k = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

function format(s) {
  return [
    `Session: ${path.basename(s.file)}`,
    '',
    '| | Turns | Fresh tokens | Cache reads | Peak context |',
    '|---|---|---|---|---|',
    `| Main conversation | ${s.main.turns} | ${k(s.freshMain)} | ${k(s.main.cacheRead)} | ${k(s.main.peakContext)} |`,
    `| Sub-agents (${s.sub.count}) | ${s.sub.turns} | ${k(s.freshSub)} | ${k(s.sub.cacheRead)} | ${k(s.sub.peakContext)} (largest) |`,
    `| Total | ${s.main.turns + s.sub.turns} | ${k(s.freshTotal)} | ${k(s.main.cacheRead + s.sub.cacheRead)} | |`,
    '',
    'Fresh tokens = input + cache writes + output. Peak context = the largest window one turn sent.',
  ].join('\n');
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const json = argv.includes('--json');
  let file = argv.find((a) => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--project');
  if (argv.includes('--latest')) {
    const pi = argv.indexOf('--project');
    file = latest(pi !== -1 ? argv[pi + 1] : undefined);
  }
  if (!file || !fs.existsSync(file)) {
    process.stderr.write('Usage: node session-stats.js <session.jsonl> | --latest [--project <dir>] [--json]\n');
    process.exit(1);
  }
  const s = sessionStats(path.resolve(file));
  process.stdout.write((json ? JSON.stringify(s, null, 2) : format(s)) + '\n');
}

module.exports = { sessionStats, measure, format };
