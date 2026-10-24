#!/usr/bin/env node
'use strict';
/**
 * Loop guard for repeating work (copied to .agents/tools/loop.js by init).
 *
 *   loop.js start --name fix-tests --check "npm test" [--goal "tests green"] [--max 8] [--stuck 2]
 *   loop.js check --name fix-tests          run the check command, record the round, print the verdict
 *   loop.js step  --name fix-tests --result pass|fail [--sig "<error text>"] [--note "..."]
 *                                           record a round whose check you ran yourself
 *   loop.js status [--name fix-tests]
 *   loop.js stop --name fix-tests [--reason "..."]
 *
 * Verdict is one line: DONE, CONTINUE, or STOP with the reason. STOP when the round limit is reached,
 * or the same failure repeats (stuck) so another try with the same approach will not help. Defaults
 * come from limits.maxLoopRounds (8) and limits.stuckRepeats (2) in .agents/config.json.
 * State: .agents/.loops/<name>.json (gitignored).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { loadConfig } = require('./lib/config');
const B = require('./lib/budget');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const k = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[k] = true;
    else out[k] = argv[++i];
  }
  return out;
}

const safe = (n) => String(n || 'default').replace(/[^\w.-]/g, '_').slice(0, 60) || 'default';
const file = (root, name) => path.join(root, '.agents', '.loops', `${safe(name)}.json`);
const read = (root, name) => {
  try {
    return JSON.parse(fs.readFileSync(file(root, name), 'utf8'));
  } catch (_) {
    return null;
  }
};
const write = (root, name, st) => {
  fs.mkdirSync(path.dirname(file(root, name)), { recursive: true });
  fs.writeFileSync(file(root, name), JSON.stringify(st, null, 2));
};

/** A failure signature that ignores timings, paths' temp parts and numbers, so "the same error" matches. */
function signature(text) {
  const t = String(text || '')
    .split(/\r?\n/)
    .filter((l) => /error|fail|expected|assert|not ok|✖|exception|cannot|undefined/i.test(l))
    .slice(0, 12)
    .join('\n')
    .replace(/\d+(\.\d+)?\s*(ms|s)\b/g, '')
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return crypto.createHash('sha1').update(t || String(text || '').slice(-400)).digest('hex').slice(0, 10);
}

function verdict(st) {
  const last = st.rounds[st.rounds.length - 1];
  if (st.stopped) return `STOP: ${st.stopped}`;
  if (!last) return 'CONTINUE: no round recorded yet.';
  if (last.result === 'pass') {
    st.stopped = 'done';
    return `DONE: check passed in round ${st.rounds.length}. Report the evidence and end the loop.`;
  }
  if (st.rounds.length >= st.max) {
    st.stopped = `round limit ${st.max} reached`;
    return `STOP: round limit ${st.max} reached without a pass. Summarise what you tried and ask the user; do not start another round.`;
  }
  const tail = st.rounds.slice(-st.stuck);
  if (tail.length >= st.stuck && tail.every((r) => r.result === 'fail' && r.sig && r.sig === last.sig)) {
    st.stopped = `stuck: the same failure ${st.stuck} rounds in a row`;
    return `STOP: stuck, the same failure ${st.stuck} rounds in a row. Change the approach (re-read the error, check an assumption, ask) or ask the user.`;
  }
  return `CONTINUE: round ${st.rounds.length} of ${st.max} failed. Change something specific, then run the check again.`;
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const a = parseArgs(rest);
  const cfg = loadConfig(process.cwd());
  const lim = B.limitsFrom(cfg);
  const root = cfg.root;
  const out = (s) => process.stdout.write(s + '\n');
  const name = a.name && a.name !== true ? a.name : 'default';
  if (cmd === 'start') {
    const st = { name, goal: a.goal || '', check: a.check && a.check !== true ? a.check : '', max: Number(a.max) || lim.maxLoopRounds, stuck: Number(a.stuck) || lim.stuckRepeats, started: new Date().toISOString(), rounds: [], stopped: null };
    write(root, name, st);
    out(`Loop "${name}" started: up to ${st.max} rounds, stop if the same failure repeats ${st.stuck} times.${st.check ? ` Check: ${st.check}` : ' Record rounds with: loop.js step --result pass|fail'}`);
    return;
  }
  if (cmd === 'status') {
    const names = a.name ? [name] : fs.existsSync(path.join(root, '.agents', '.loops')) ? fs.readdirSync(path.join(root, '.agents', '.loops')).map((f) => f.replace(/\.json$/, '')) : [];
    if (!names.length) out('No loops.');
    for (const n of names) {
      const st = read(root, n);
      if (st) out(`${n}: ${st.stopped ? `ended (${st.stopped})` : 'running'}, ${st.rounds.length}/${st.max} rounds${st.goal ? `, goal: ${st.goal}` : ''}`);
    }
    return;
  }
  const st = read(root, name);
  if (!st) {
    out(`STOP: no loop named "${name}". Start one: loop.js start --name ${name} --check "<command>"`);
    process.exitCode = 1;
    return;
  }
  if (cmd === 'stop') {
    st.stopped = a.reason && a.reason !== true ? a.reason : 'stopped by the agent';
    write(root, name, st);
    out(`Loop "${name}" ended: ${st.stopped}`);
    return;
  }
  if (st.stopped) {
    out(`STOP: loop "${name}" already ended (${st.stopped}). Start a new one only if the user asks.`);
    process.exitCode = 1;
    return;
  }
  if (cmd === 'check') {
    if (!st.check) {
      out('STOP: this loop has no --check command. Use: loop.js step --result pass|fail');
      process.exitCode = 1;
      return;
    }
    const r = spawnSync(st.check, { cwd: root, shell: true, encoding: 'utf8', timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });
    const text = `${r.stdout || ''}\n${r.stderr || ''}`;
    const pass = r.status === 0;
    st.rounds.push({ t: new Date().toISOString(), result: pass ? 'pass' : 'fail', sig: pass ? '' : signature(text), tail: text.trim().split(/\r?\n/).slice(-6).join('\n').slice(0, 600) });
    const v = verdict(st);
    write(root, name, st);
    if (!pass) out(st.rounds[st.rounds.length - 1].tail);
    out(v);
  } else if (cmd === 'step') {
    const result = a.result === 'pass' ? 'pass' : 'fail';
    st.rounds.push({ t: new Date().toISOString(), result, sig: result === 'fail' ? signature(a.sig && a.sig !== true ? a.sig : a.note) : '', note: a.note && a.note !== true ? String(a.note).slice(0, 300) : '' });
    const v = verdict(st);
    write(root, name, st);
    out(v);
  } else {
    out(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^#!.*\n'use strict';\n\/\*\*/, '') + '*/');
    process.exitCode = cmd ? 1 : 0;
  }
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    process.stderr.write(`loop.js: ${e.message}\n`);
    process.exit(1);
  }
}

module.exports = { signature };
