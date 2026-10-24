#!/usr/bin/env node
'use strict';
/**
 * Tool-neutral git hooks: the same commit checks the Claude Code hooks run, for any
 * agent or human. Copied to .agents/tools/ by init (--with-git-hooks).
 *
 *   node git-guard.js pre-commit          blocks staged env files and clear secrets
 *   node git-guard.js commit-msg <file>   blocks Co-Authored-By and "Generated with" lines
 *
 * Off switch: AWK_HOOKS=off.
 */
const fs = require('fs');
const { execFileSync } = require('child_process');
const { scanLines, addedLinesFromDiff, isEnvFile } = require('./lib/secrets');

const TRAILER = /^\s*(co-authored-by:|generated with\b|🤖)/im;

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function preCommit() {
  const files = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR']).split('\n').filter(Boolean);
  const problems = [];
  for (const f of files) if (isEnvFile(f)) problems.push(`${f}: env file staged (secrets belong in the secret store)`);
  const diff = git(['diff', '--cached', '--unified=0', '--no-color']);
  for (const hit of scanLines(addedLinesFromDiff(diff)).block) {
    problems.push(`${hit.file}:${hit.line} looks like a secret (${hit.name}; if it is a fake, add awk-allow-secret on that line)`);
  }
  return problems;
}

function commitMsg(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/^#.*$/gm, '');
  return TRAILER.test(text) ? ['commit message has a Co-Authored-By, "Generated with" or robot line; remove it'] : [];
}

if (require.main === module) {
  if (process.env.AWK_HOOKS === 'off') process.exit(0);
  const [cmd, file] = process.argv.slice(2);
  let problems = [];
  try {
    problems = cmd === 'pre-commit' ? preCommit() : cmd === 'commit-msg' ? commitMsg(file) : [];
  } catch (e) {
    process.stderr.write(`git-guard: check skipped (${e.message.split('\n')[0]})\n`);
    process.exit(0);
  }
  if (problems.length) {
    process.stderr.write(`git-guard blocked the commit:\n${problems.map((p) => `  - ${p}`).join('\n')}\n`);
    process.exit(1);
  }
}

module.exports = { preCommit, commitMsg, TRAILER };
