'use strict';
/**
 * Guess the size of a task from its text and the repo, so the kit decides without being told the
 * numbers. It is a heuristic: it reads the task words, paths and a quick `git grep`, never the files.
 * The agent may override any number on the command line.
 */
const { execFileSync } = require('child_process');

const RISK = /\b(auth\w*|login|password|passwd|token|secret|credential\w*|payment\w*|billing|invoice|stripe|refund|checkout|migrat\w+|schema|drop|delete\w*|truncate|permission\w*|rbac|encrypt\w*|production|prod|deploy\w*|pii|gdpr|money|wallet)\b/i;
const WIDE = /\b(whole repo|entire|everywhere|across|all (the )?(files|modules|services|routes|endpoints)|every (file|module|service|route|endpoint)|rename|refactor|migrate to|upgrade|rewrite|audit)\b/i;
const STOP = new Set('about above after again also another because before being between could every first following from have into make more most other should since some than that their them then there these they this those through under until using want were what when where which while with without would your please add fix change update make sure code file files test tests'.split(' '));

function grepCount(root, word) {
  try {
    const out = execFileSync('git', ['grep', '-l', '-i', '-F', '-e', word], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 16 * 1024 * 1024, timeout: 8000 });
    return out.split('\n').filter(Boolean).length;
  } catch (_) {
    return 0;
  }
}

function estimate(text, root) {
  const t = String(text || '');
  const pathsMentioned = new Set((t.match(/[\w./-]+\.\w{1,5}\b/g) || []).filter((p) => /[./]/.test(p)));
  const lines = t.split(/\r?\n/).filter((l) => /^\s*(\d+[.)]|[-*])\s+\S/.test(l)).length;
  const conj = (t.match(/(?:,|;|\band\b|\balso\b|\bplus\b|\bthen\b)\s+(?:add|fix|build|create|update|write|remove|implement|migrate|refactor|test|document|change|rename)\b/gi) || []).length;
  const parts = Math.min(6, Math.max(1, lines || 1 + conj));
  const words = [...new Set((t.toLowerCase().match(/[a-z_][a-z0-9_]{4,}/g) || []).filter((w) => !STOP.has(w)))].slice(0, 6);
  const hits = words.map((w) => grepCount(root, w)).filter((n) => n > 0 && n < 400);
  const touch = hits.length ? Math.round(hits.reduce((a, b) => a + b, 0) / hits.length) : 0;
  const wide = WIDE.test(t);
  const read = Math.min(80, Math.max(pathsMentioned.size, touch) + (wide ? 30 : 0));
  const files = Math.min(40, Math.max(pathsMentioned.size, Math.ceil(touch / 3), parts) + (wide ? 10 : 0));
  const risk = RISK.test(t) ? 'high' : 'none';
  return { files, read, parts, risk, why: { words, pathsMentioned: pathsMentioned.size, listItems: lines, conjunctions: conj, wide, matches: hits } };
}

module.exports = { estimate };
