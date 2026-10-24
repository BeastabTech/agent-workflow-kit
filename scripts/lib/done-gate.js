'use strict';
/**
 * "Done gate": reads a session transcript and says whether the agent may stop. It looks only at
 * what the agent actually did: which files it edited, whether it ran a test command after its last
 * edit, whether that run failed, and whether it touched any test file. It never judges the code.
 */
const fs = require('fs');

const TEST_FILE = /(^|[\\/])(tests?|__tests__|spec|specs)[\\/]|\.(spec|test)\.[a-z0-9]+$|_test\.(go|py)$|(^|[\\/])test_[^\\/]*\.py$/i;
const DOC_OR_CONFIG = /\.(md|mdx|txt|json|ya?ml|toml|lock|svg|png|jpe?g|gif|ico|env|example)$|(^|[\\/])\.(github|agents|claude)[\\/]|(^|[\\/])(CHANGELOG|RELEASE_NOTES|LICENSE)/i;
const TEST_CMD = /\b(jest|vitest|mocha|pytest|py\.test|go test|cargo test|npm (run )?test|yarn (run )?test|pnpm (run )?test|bun test|node --test|phpunit|rspec|mvn (-q )?test|gradle(w)? test|dotnet test|deno test|uvu|ava|tap)\b/i;
const FAILED = /(\b[1-9]\d* (failed|failing)\b|^\s*FAIL\b|\bFAIL\s|✖|\bnot ok\b|AssertionError|error TS\d+|Test Suites?:.*\b[1-9]\d* failed|Tests?:.*\b[1-9]\d* failed|Traceback \(most recent)/im;
const BASH_WRITE = />>?\s*[\w./~-]+|\bsed\s+-i|\btee\b|\bperl\s+-p?i|python3?\s+-?\s*<<|node\s+-e\s+.*writeFile|\bcp\b|\bmv\b/;

function lines(file) {
  const out = [];
  for (const l of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!l.trim()) continue;
    try {
      out.push(JSON.parse(l));
    } catch (_) {}
  }
  return out;
}

const text = (c) => (typeof c === 'string' ? c : Array.isArray(c) ? c.map((x) => (x && x.text) || '').join('\n') : '');

/** @param {string[]} extraTestCmds substrings (from commands.test in the project config) that also count as a test run */
function analyse(file, extraTestCmds = []) {
  const events = [];
  const results = new Map();
  let i = 0;
  for (const o of lines(file)) {
    const content = o.message && o.message.content;
    if (!Array.isArray(content)) continue;
    for (const c of content) {
      if (o.type === 'assistant' && c.type === 'tool_use') events.push({ i: i++, id: c.id, name: c.name, input: c.input || {} });
      if (o.type === 'user' && c.type === 'tool_result') results.set(c.tool_use_id, { text: text(c.content), error: Boolean(c.is_error) });
    }
  }
  const edits = [];
  const runs = [];
  for (const e of events) {
    if (/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(e.name)) {
      const f = e.input.file_path || e.input.notebook_path || '';
      if (f) edits.push({ i: e.i, file: f });
    } else if (e.name === 'Bash') {
      const cmd = String(e.input.command || '');
      const isTest = TEST_CMD.test(cmd) || extraTestCmds.some((t) => t && cmd.includes(t));
      if (isTest) {
        const r = results.get(e.id) || { text: '', error: false };
        runs.push({ i: e.i, cmd, failed: r.error || FAILED.test(r.text) });
      }
      if (BASH_WRITE.test(cmd) && !isTest) {
        const paths = cmd.match(/[\w./-]+\.[a-z0-9]{1,5}\b/gi) || [];
        const targets = paths.filter((p) => /[\\/]/.test(p) || !DOC_OR_CONFIG.test(p));
        if (/\b(sed\s+-i|tee|perl\s+-p?i|python3?\s+-?\s*<<|>>?\s*[\w./~-]+\.[a-z0-9]+)/.test(cmd)) for (const p of targets) edits.push({ i: e.i, file: p, viaBash: true });
      }
    }
  }
  const source = edits.filter((e) => !TEST_FILE.test(e.file) && !DOC_OR_CONFIG.test(e.file));
  const testEdits = edits.filter((e) => TEST_FILE.test(e.file));
  const lastEdit = edits.reduce((n, e) => Math.max(n, e.i), -1);
  const after = runs.filter((r) => r.i > lastEdit);
  return {
    sourceEdited: source.length > 0,
    testFilesTouched: testEdits.length > 0,
    ranTestsAfterLastEdit: after.length > 0,
    lastRunFailed: after.length > 0 && after[after.length - 1].failed,
    runs: runs.length,
    lastCmd: after.length ? after[after.length - 1].cmd : '',
  };
}

/** gate = { tests: bool, addTests: bool } -> array of problems (empty = may stop) */
function problems(a, gate, testHint) {
  const out = [];
  if (!a.sourceEdited) return out;
  const how = testHint ? `the project's test command (${testHint})` : "the project's tests";
  if (gate.tests && !a.ranTestsAfterLastEdit) out.push(`You changed code but did not run ${how} after your last edit. Run it now and read the result.`);
  else if (gate.tests && a.lastRunFailed) out.push('Your last test run after the final edit failed. Fix the failure (or explain, with evidence, why it is unrelated) before finishing.');
  if (gate.addTests && !a.testFilesTouched) out.push('You changed behaviour without adding or updating a test. List the edge cases of this change (empty, invalid, boundary, repeated call, other time zones or DST, old behaviour that must still work), add a test for each, run them, and fix what they find.');
  return out;
}

module.exports = { analyse, problems, TEST_FILE };
