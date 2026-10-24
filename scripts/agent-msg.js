#!/usr/bin/env node
'use strict';
/**
 * Agent message log: one append-only Markdown file that every agent (any tool) can read and write.
 * Lives at <main checkout>/.agents/LOG.md, so all git worktrees share it. Override with
 * "sharedDir" in .agents/config.json or the AWK_SHARED_DIR env var (for a synced folder).
 *
 * Usage:
 *   msg.js post --from <name> --to <name|all|manager|user> --type <type> --topic "<text>" [--files a,b] [--status open] [--body "<text>" | stdin]
 *   msg.js inbox --for <name> [--all]          new messages for <name> (or all); marks them read
 *   msg.js thread --topic "<text>"             every message on one topic
 *   msg.js claims                              active file claims (claim without a later release)
 *   msg.js tail [-n 5]                         last n messages
 *   msg.js where                               print the log path
 * Types: brief, question, answer, claim, release, review-request, review, done, blocked, note, approval-request
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const TYPES = ['brief', 'question', 'answer', 'claim', 'release', 'review-request', 'review', 'done', 'blocked', 'note', 'approval-request'];

function git(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (_) {
    return '';
  }
}

function baseDir(cwd) {
  if (process.env.AWK_SHARED_DIR) return path.resolve(process.env.AWK_SHARED_DIR);
  const top = git(['rev-parse', '--show-toplevel'], cwd) || cwd;
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(top, '.agents', 'config.json'), 'utf8'));
    if (cfg.sharedDir) return path.resolve(top, cfg.sharedDir);
  } catch (_) {}
  const common = git(['rev-parse', '--path-format=absolute', '--git-common-dir'], cwd);
  const root = common && path.basename(common) === '.git' ? path.dirname(common) : top;
  return path.join(root, '.agents');
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) out[key] = true;
      else {
        out[key] = next;
        i++;
      }
    } else if (a === '-n') {
      out.n = argv[++i];
    } else out._.push(a);
  }
  return out;
}

function parse(text) {
  const parts = text.split(/^### /m).slice(1);
  return parts.map((p) => {
    const [head, ...rest] = p.split('\n');
    const m = /^(\S+) · from (.+?) · to (.+?) · (\S+)\s*$/.exec(head.trim()) || [];
    const msg = { time: m[1], from: m[2], to: m[3], type: m[4], raw: '### ' + p.trimEnd() };
    for (const line of rest) {
      const f = /^(Topic|Files|Status|Re):\s*(.*)$/.exec(line);
      if (f) msg[f[1].toLowerCase()] = f[2].trim();
    }
    return msg;
  });
}

function readLog(dir) {
  try {
    return fs.readFileSync(path.join(dir, 'LOG.md'), 'utf8');
  } catch (_) {
    return '';
  }
}

function post(dir, a) {
  for (const k of ['from', 'to', 'type', 'topic']) {
    if (!a[k] || a[k] === true) throw new Error(`--${k} is required`);
  }
  if (!TYPES.includes(a.type)) throw new Error(`--type must be one of: ${TYPES.join(', ')}`);
  let body = typeof a.body === 'string' ? a.body : '';
  if (!body && !process.stdin.isTTY) {
    try {
      body = fs.readFileSync(0, 'utf8');
    } catch (_) {}
  }
  const one = (s) => String(s).replace(/\s*\n\s*/g, ' ').trim();
  const lines = [`### ${new Date().toISOString()} · from ${one(a.from)} · to ${one(a.to)} · ${a.type}`, `Topic: ${one(a.topic)}`];
  if (a.files && a.files !== true) lines.push(`Files: ${one(a.files)}`);
  if (a.re && a.re !== true) lines.push(`Re: ${one(a.re)}`);
  lines.push(`Status: ${a.status && a.status !== true ? one(a.status) : 'open'}`);
  const entry = '\n' + lines.join('\n') + '\n' + (body.trim() ? '\n' + body.trim().replace(/^### /gm, '#### ') + '\n' : '');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'LOG.md');
  if (!fs.existsSync(file)) fs.writeFileSync(file, '# Agent message log\n\nAppend-only. Write with `node .agents/tools/msg.js post ...`. Never edit another agent\'s entry.\n');
  fs.appendFileSync(file, entry);
  return lines[0];
}

function addressed(msg, who) {
  const to = String(msg.to || '').toLowerCase();
  return to === 'all' || to.split(/[,\s]+/).includes(String(who).toLowerCase());
}

function inbox(dir, a) {
  const who = a.for;
  if (!who || who === true) throw new Error('--for is required');
  const msgs = parse(readLog(dir));
  const readDir = path.join(dir, '.read');
  const mark = path.join(readDir, who.replace(/[^\w.-]/g, '_'));
  let last = '';
  try {
    last = fs.readFileSync(mark, 'utf8').trim();
  } catch (_) {}
  const mine = msgs.filter((m) => addressed(m, who) && String(m.from).toLowerCase() !== String(who).toLowerCase());
  const fresh = a.all ? mine : mine.filter((m) => !last || (m.time && m.time > last));
  if (msgs.length) {
    fs.mkdirSync(readDir, { recursive: true });
    fs.writeFileSync(mark, msgs[msgs.length - 1].time || '');
  }
  return fresh;
}

function claims(dir) {
  const active = new Map();
  for (const m of parse(readLog(dir))) {
    const key = `${m.from}|${m.topic}`;
    if (m.type === 'claim') active.set(key, m);
    if (m.type === 'release' || m.type === 'done') {
      active.delete(key);
      for (const [k, c] of active) if (c.from === m.from && (!m.topic || c.topic === m.topic || m.re === c.topic)) active.delete(k);
    }
  }
  return [...active.values()];
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const a = parseArgs(rest);
  const dir = baseDir(process.cwd());
  const print = (list) => process.stdout.write(list.length ? list.map((m) => m.raw).join('\n\n') + '\n' : '(none)\n');
  switch (cmd) {
    case 'post':
      process.stdout.write(post(dir, a) + '\n');
      break;
    case 'inbox':
      print(inbox(dir, a));
      break;
    case 'thread':
      print(parse(readLog(dir)).filter((m) => m.topic === a.topic || m.re === a.topic));
      break;
    case 'claims':
      print(claims(dir));
      break;
    case 'tail': {
      const n = Number(a.n || 5);
      print(parse(readLog(dir)).slice(-n));
      break;
    }
    case 'where':
      process.stdout.write(path.join(dir, 'LOG.md') + '\n');
      break;
    default:
      process.stdout.write(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^#!.*\n'use strict';\n\/\*\*/, '') + '*/\n');
      process.exitCode = cmd ? 1 : 0;
  }
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    process.stderr.write(`msg.js: ${e.message}\n`);
    process.exit(1);
  }
}
module.exports = { parse, claims, baseDir, TYPES };
