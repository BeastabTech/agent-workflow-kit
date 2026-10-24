#!/usr/bin/env node
'use strict';
/**
 * PreToolUse guard for Bash.
 * Checks: ai-trailers, secret-scan, explicit-staging, force-push, protected-branch, destructive-db.
 * Blocks only clear cases; asks or warns when unsure. Any internal error lets the command through.
 */
const fs = require('fs');
const path = require('path');
const { loadConfig, enabled, git } = require('../lib/config');
const { matchesAny } = require('../lib/glob');
const { scanLines, addedLinesFromDiff, isEnvFile } = require('../lib/secrets');
const { readInput, respondPreToolUse } = require('../lib/hook-io');

const GIT = String.raw`\bgit(?:\s+(?:-C|-c)\s+\S+)*\s+`;
const RE_COMMIT = new RegExp(GIT + String.raw`commit\b`);
const RE_PUSH = new RegExp(GIT + String.raw`push\b([^\n;&|]*)`);

const TRAILERS = [
  [/(?:^|[\s"'])co-authored-by\s*:/im, 'Co-Authored-By trailer'],
  [/generated\s+with\b/i, '"Generated with" line'],
  [/\u{1F916}/u, 'robot emoji attribution'],
];

const DESTRUCTIVE_DB = [
  [/\bprisma\s+migrate\s+reset\b/i, 'prisma migrate reset'],
  [/\bprisma\s+db\s+push\b/i, 'prisma db push'],
  [/\b(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?db:(?:migrate:)?(?:reset|push|drop)\b/i, 'db reset/push/drop script'],
  [/\bdrop\s+(?:table|database|schema)\b/i, 'DROP TABLE/DATABASE/SCHEMA'],
  [/\btruncate\s+(?:table\s+)?["'`]?\w/i, 'TRUNCATE'],
  [/\bdelete\s+from\s+["'`\w.]+\s*(?:;|["']|$)/im, 'DELETE without WHERE'],
  [/\b(?:rails|rake)\s+db:(?:drop|reset|schema:load)\b/i, 'rails db drop/reset'],
  [/\bmanage\.py\s+(?:flush|reset_db)\b/i, 'django flush'],
  [/\bdropDatabase\s*\(/, 'mongo dropDatabase'],
  [/\b(?:flushall|flushdb)\b/i, 'redis FLUSHALL/FLUSHDB'],
  [/\bdropdb\s+\S/, 'dropdb'],
  [/\b(?:typeorm|sequelize(?:-cli)?)\s+(?:schema:drop|db:drop)\b/i, 'ORM schema drop'],
  [/\bknex\s+migrate:rollback\s+--all\b/i, 'knex rollback --all'],
  [/\bterraform\s+destroy\b/i, 'terraform destroy'],
];

const READ_ONLY_FIRST = /^\s*(?:grep|rg|ag|git\s+(?:grep|log|show|diff)|man|which)\b/;

function segments(cmd) {
  return cmd.split(/\n|&&|\|\||;|\|/).map((s) => s.trim()).filter(Boolean);
}

function tokens(seg) {
  return (seg.match(/"[^"]*"|'[^']*'|\S+/g) || []).map((t) => t.replace(/^["']|["']$/g, ''));
}

/** Git Bash writes C:\\x as /c/x; node on Windows needs the drive form. */
function nativePath(p) {
  return process.platform === 'win32' ? p.replace(/^\/([a-zA-Z])(?=\/|$)/, '$1:') : p;
}

function gitCwd(seg, cwd) {
  const m = /\bgit\s+-C\s+("[^"]+"|'[^']+'|\S+)/.exec(seg);
  return m ? path.resolve(cwd, nativePath(m[1].replace(/^["']|["']$/g, ''))) : cwd;
}

function checkTrailers(cmd, cwd) {
  if (!RE_COMMIT.test(cmd)) return [];
  let text = cmd;
  const fileArg = /\s(?:-F|--file)(?:=|\s+)("[^"]+"|'[^']+'|\S+)/.exec(cmd);
  if (fileArg) {
    try {
      text += '\n' + fs.readFileSync(path.resolve(cwd, fileArg[1].replace(/^["']|["']$/g, '')), 'utf8');
    } catch (_) {}
  }
  return TRAILERS.filter(([re]) => re.test(text)).map(([, what]) => ({
    level: 'deny',
    check: 'ai-trailers',
    reason: `Commit message contains a ${what}. Remove it and commit again (team rule: no AI attribution in commits).`,
  }));
}

/** Collect the lines a commit in this command would add: staged, plus paths added in the same command. */
function pendingLines(cmd, cwd) {
  const lines = addedLinesFromDiff(git(['diff', '--cached', '-U0', '--no-color'], cwd));
  const names = new Set(git(['diff', '--cached', '--name-only'], cwd).split('\n').filter(Boolean));
  let all = /\bgit\s+commit\b[^\n;&|]*\s-[a-zA-Z]*a/.test(cmd) || /\bgit\s+commit\b[^\n;&|]*--all\b/.test(cmd);
  const paths = [];
  for (const seg of segments(cmd)) {
    const t = tokens(seg);
    const i = t.indexOf('add');
    if (t[0] !== 'git' || i === -1) continue;
    for (const a of t.slice(i + 1)) {
      if (a === '-A' || a === '--all' || a === '.' || a === '-u') all = true;
      else if (!a.startsWith('-')) paths.push(a);
    }
  }
  if (all || paths.length) {
    const scope = all ? [] : ['--', ...paths];
    for (const l of addedLinesFromDiff(git(['diff', '-U0', '--no-color', ...scope], cwd))) lines.push(l);
    git(['diff', '--name-only', ...scope], cwd).split('\n').filter(Boolean).forEach((n) => names.add(n));
    const untracked = git(['ls-files', '--others', '--exclude-standard', ...scope], cwd).split('\n').filter(Boolean);
    for (const f of untracked.slice(0, 500)) {
      names.add(f);
      try {
        const full = path.join(cwd, f);
        if (fs.statSync(full).size > 1024 * 1024) continue;
        const buf = fs.readFileSync(full);
        if (buf.includes(0)) continue;
        buf.toString('utf8').split('\n').forEach((text, idx) => lines.push({ file: f, line: idx + 1, text }));
      } catch (_) {}
    }
  }
  return { lines, names: [...names] };
}

function checkSecrets(cmd, cwd, cfg) {
  if (!RE_COMMIT.test(cmd)) return [];
  const root = git(['rev-parse', '--show-toplevel'], cwd);
  if (!root) return [];
  const { lines, names } = pendingLines(cmd, root);
  const allow = cfg.secretScan.allowPaths || [];
  const kept = lines.filter((l) => l.file && !matchesAny(l.file, allow));
  const out = [];
  const envFiles = names.filter((n) => isEnvFile(n) && !matchesAny(n, allow));
  if (envFiles.length) {
    out.push({ level: 'deny', check: 'secret-scan', reason: `Env file would be committed: ${envFiles.join(', ')}. Unstage it and add it to .gitignore.` });
  }
  const { block, ask } = scanLines(kept);
  const fmt = (f) => `${f.file}:${f.line} (${f.name})`;
  if (block.length) {
    out.push({ level: 'deny', check: 'secret-scan', reason: `Possible secret in the commit: ${block.slice(0, 5).map(fmt).join('; ')}. Move it to env/secret storage. False positive: add "awk-allow-secret" on that line or the path to secretScan.allowPaths.` });
  } else if (ask.length) {
    out.push({ level: 'ask', check: 'secret-scan', reason: `Value that looks like a secret: ${ask.slice(0, 5).map(fmt).join('; ')}. Confirm it is not a real credential.` });
  }
  return out;
}

function checkStaging(cmd, cfg) {
  if (!cfg.hasTeamConfig || cfg.staging !== 'explicit') return [];
  const broad = segments(cmd).some((seg) => {
    const t = tokens(seg);
    if (t[0] !== 'git') return false;
    const i = t.indexOf('add');
    if (i !== -1 && t.slice(i + 1).some((a) => a === '-A' || a === '--all' || a === '.')) return true;
    const c = t.indexOf('commit');
    return c !== -1 && t.slice(c + 1).some((a) => /^-[a-zA-Z]*a[a-zA-Z]*$/.test(a) || a === '--all');
  });
  if (!broad) return [];
  const level = cfg.workMode === 'shared' ? 'deny' : 'warn';
  return [{ level, check: 'explicit-staging', reason: 'Stage explicit paths only (git add <file> ...). Other agents may have unfinished work in this checkout. Check `git diff --cached --stat` before committing.' }];
}

function currentBranch(cwd) {
  return git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
}

function checkPush(cmd, cwd, cfg) {
  const out = [];
  for (const seg of segments(cmd)) {
    const m = RE_PUSH.exec(seg);
    if (!m) continue;
    const args = tokens(m[1]);
    if (args.some((a) => a === '--force' || a === '-f' || /^-[a-zA-Z]*f[a-zA-Z]*$/.test(a) || /^\+/.test(a))) {
      out.push({ level: 'deny', check: 'force-push', reason: 'Force push is not allowed. Pull and merge instead, or ask the human to do it.' });
      continue;
    }
    if (args.some((a) => a.startsWith('--force-with-lease'))) {
      out.push({ level: 'ask', check: 'force-push', reason: 'Push with --force-with-lease rewrites remote history. Confirm with the human.' });
    }
    if (!cfg.hasTeamConfig) continue;
    const refs = args.filter((a) => !a.startsWith('-')).slice(1);
    const targets = refs.length ? refs.map((r) => r.split(':').pop()) : [currentBranch(gitCwd(seg, cwd))];
    const hit = targets.filter((b) => cfg.protectedBranches.includes(b));
    if (hit.length) {
      out.push({ level: 'ask', check: 'protected-branch', reason: `Push to protected branch ${hit.join(', ')}. This may deploy. Needs the human's yes typed in this session.` });
    }
  }
  return out;
}

function checkCommitBranch(cmd, cwd, cfg) {
  if (!cfg.hasTeamConfig || !RE_COMMIT.test(cmd)) return [];
  const b = currentBranch(cwd);
  if (!cfg.protectedBranches.includes(b)) return [];
  return [{ level: 'ask', check: 'protected-branch', reason: `Commit directly on protected branch "${b}". Confirm this is intended.` }];
}

function checkDestructiveDb(cmd, cfg) {
  if (!cfg.personal.destructiveDbGuard || cfg.destructiveDb === 'off') return [];
  const out = [];
  for (const seg of segments(cmd)) {
    if (READ_ONLY_FIRST.test(seg)) continue;
    for (const [re, what] of DESTRUCTIVE_DB) {
      if (re.test(seg)) {
        out.push({
          level: cfg.destructiveDb === 'ask' ? 'ask' : 'deny',
          check: 'destructive-db',
          reason: `Destructive data command (${what}). Never run it against a shared database. If it is a disposable local DB, the human can run it in a terminal, or set "destructiveDb": "ask" in .agents/config.json.`,
        });
        break;
      }
    }
  }
  return out.slice(0, 1);
}

function main() {
  const input = readInput();
  const cmd = String((input.tool_input && input.tool_input.command) || '');
  // `git -C <dir>` acts on another repo: read that repo's team config and state.
  const cwd = gitCwd(cmd, input.cwd || process.cwd());
  if (!cmd) process.exit(0);
  const cfg = loadConfig(cwd);
  if (cfg.hooksOff) process.exit(0);
  const findings = [];
  const run = (check, fn) => {
    if (!enabled(cfg, check)) return;
    try {
      findings.push(...fn());
    } catch (_) {}
  };
  run('ai-trailers', () => (cfg.personal.blockAiTrailers ? checkTrailers(cmd, cwd) : []));
  run('secret-scan', () => (cfg.personal.secretScan ? checkSecrets(cmd, cwd, cfg) : []));
  run('explicit-staging', () => checkStaging(cmd, cfg));
  run('force-push', () => checkPush(cmd, cwd, { ...cfg, hasTeamConfig: false }));
  run('protected-branch', () => [...checkPush(cmd, cwd, cfg).filter((f) => f.check === 'protected-branch'), ...checkCommitBranch(cmd, cwd, cfg)]);
  run('destructive-db', () => checkDestructiveDb(cmd, cfg));
  respondPreToolUse(findings);
}

if (require.main === module) main();
module.exports = { checkTrailers, checkStaging, checkPush, checkDestructiveDb, segments, tokens };
