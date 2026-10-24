#!/usr/bin/env node
'use strict';
/**
 * Turns bench-real.js result files into the table the README shows: per project size and task size,
 * per edition, mean fresh tokens, mean output tokens, share of runs where ALL hidden tests passed,
 * and the change against the no-kit arm. Tokens, not money (prices change).
 *
 * Usage: node scripts/bench-summary.js results1.json [results2.json ...] [--md]
 */
const fs = require('fs');

const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const rows = files.flatMap((f) => JSON.parse(fs.readFileSync(f, 'utf8')).rows);
const mean = (a) => (a.length ? a.reduce((n, x) => n + x, 0) / a.length : 0);
const k = (n) => (n >= 1000 ? `${(n / 1000).toFixed(0)}k` : String(Math.round(n)));
const pct = (n) => `${Math.round(n * 100)}%`;
const ARMS = ['none', 'lite', 'low-tokens', 'auto', 'normal', 'best'];
const cells = [...new Set(rows.map((r) => `${r.project || 'project'}|${r.size}`))].sort();

const out = [];
for (const cell of cells) {
  const [project, size] = cell.split('|');
  const inCell = rows.filter((r) => `${r.project || 'project'}|${r.size}` === cell);
  const tasks = [...new Set(inCell.map((r) => r.task))];
  out.push(`\n**${project} project, ${size} task** (${tasks.join(', ')}; ${inCell.filter((r) => r.arm === 'none').length} runs for no kit)\n`);
  out.push('| Edition | All hidden tests pass | Hidden tests passed | Fresh tokens | vs no kit | Output tokens | Turns |');
  out.push('|---|---|---|---|---|---|---|');
  const base = mean(inCell.filter((r) => r.arm === 'none').map((r) => r.freshTotal || 0));
  for (const arm of ARMS) {
    const g = inCell.filter((r) => r.arm === arm);
    if (!g.length) continue;
    const fresh = mean(g.map((r) => r.freshTotal || 0));
    const delta = arm === 'none' || !base ? '' : `${fresh >= base ? '+' : ''}${Math.round(((fresh - base) / base) * 100)}%`;
    out.push(`| ${arm === 'none' ? 'no kit' : arm} | ${pct(g.filter((r) => r.hiddenOk).length / g.length)} (${g.filter((r) => r.hiddenOk).length}/${g.length}) | ${pct(mean(g.map((r) => (r.hiddenTotal ? r.hiddenPassed / r.hiddenTotal : 0))))} | ${k(fresh)} | ${delta} | ${k(mean(g.map((r) => r.outTok || 0)))} | ${mean(g.map((r) => r.turnsTotal || r.turns || 0)).toFixed(0)} |`);
  }
}
const total = ARMS.map((arm) => {
  const g = rows.filter((r) => r.arm === arm);
  return g.length ? `${arm === 'none' ? 'no kit' : arm}: ${pct(g.filter((r) => r.hiddenOk).length / g.length)} all-pass, ${k(mean(g.map((r) => r.freshTotal || 0)))} fresh tokens per run (${g.length} runs)` : null;
}).filter(Boolean);
out.push('\n**Overall:** ' + total.join('; '));
process.stdout.write(out.join('\n') + '\n');
