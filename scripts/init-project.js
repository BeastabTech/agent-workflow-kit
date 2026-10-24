#!/usr/bin/env node
'use strict';
/**
 * Writes the kit's project files into a target repo from templates/project.
 * Never overwrites an existing file unless --force; reports what it wrote and kept.
 *
 * Usage: node init-project.js --target <dir> [--answers answers.json] [--tools claude,codex,cursor,gemini,copilot]
 *        [--with-git-hooks] [--with-optional] [--force] [--dry-run]
 * Answers (all optional): see templates/answers.example.json
 */
const fs = require('fs');
const path = require('path');
const { DEFAULT_LIMITS } = require('./lib/budget');
const { renderFor } = require('./lib/agents');
const presets = require('./lib/presets');

const KIT = path.resolve(__dirname, '..');
const TEMPLATES = path.join(KIT, 'templates', 'project');
const OPTIONAL = path.join(KIT, 'templates', 'optional');
const ADAPTERS = path.join(KIT, 'templates', 'adapters');
const TOOLS = ['claude', 'codex', 'cursor', 'gemini', 'copilot'];
const GIT_HOOKS = {
  '.githooks/pre-commit': '#!/bin/sh\nnode .agents/tools/git-guard.js pre-commit\n',
  '.githooks/commit-msg': '#!/bin/sh\nnode .agents/tools/git-guard.js commit-msg "$1"\n',
};

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[a.slice(2)] = true;
    else {
      out[a.slice(2)] = next;
      i++;
    }
  }
  return out;
}

function list(v, fallback) {
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v === 'string' && v.trim()) return v.split(',').map((s) => s.trim()).filter(Boolean);
  return fallback;
}

function normalise(raw) {
  const a = raw || {};
  const c = a.commands || {};
  const todo = (what) => `<add ${what} command>`;
  const workMode = a.workMode === 'worktree' ? 'worktree' : 'shared';
  const stateSync = ['git', 'local', 'folder'].includes(a.stateSync) ? a.stateSync : 'git';
  const owners = Array.isArray(a.owners) && a.owners.length ? a.owners : [{ area: 'Whole repo', paths: '*', owner: a.defaultOwner || '<owner>' }];
  return {
    projectName: a.projectName || path.basename(path.resolve(a.target || '.')),
    summary: a.summary || '<one line: what this project does and for whom>',
    stack: a.stack || '<language, framework, database, hosting>',
    commands: {
      install: c.install || todo('install'),
      typecheck: c.typecheck || todo('type-check'),
      build: c.build || todo('build'),
      test: c.test || todo('test'),
      lint: c.lint || todo('lint'),
      dev: c.dev || todo('dev server'),
    },
    baseBranch: a.baseBranch || 'main',
    protectedBranches: list(a.protectedBranches, ['main', 'production']),
    protectedFiles: list(a.protectedFiles, []),
    workMode,
    stateSync,
    sharedDir: stateSync === 'folder' ? a.sharedDir || null : null,
    owners,
    defaultOwner: a.defaultOwner || owners[0].owner,
    timezone: a.timezone || 'UTC',
    commitPolicy: a.commitPolicy === 'agent-may-commit' ? 'agent-may-commit' : 'on-request',
    sourceDirs: a.sourceDirs || 'src',
    tools: list(a.tools, TOOLS).filter((t) => TOOLS.includes(t)),
    gitHooks: Boolean(a.gitHooks),
    preset: presets.pick(a.preset) || presets.DEFAULT_PRESET,
  };
}

function vars(n) {
  const md = (arr, empty) => (arr.length ? arr.map((x) => `- \`${x}\``).join('\n') : empty);
  const ownersTable = ['| Area | Paths | Owner |', '|---|---|---|', ...n.owners.map((o) => `| ${o.area || '-'} | \`${o.paths || '*'}\` | ${o.owner || n.defaultOwner} |`)].join('\n');
  const isWt = n.workMode === 'worktree';
  return {
    PROJECT_NAME: n.projectName,
    SUMMARY: n.summary,
    STACK: n.stack,
    INSTALL_CMD: n.commands.install,
    TYPECHECK_CMD: n.commands.typecheck,
    BUILD_CMD: n.commands.build,
    TEST_CMD: n.commands.test,
    LINT_CMD: n.commands.lint,
    DEV_CMD: n.commands.dev,
    BASE_BRANCH: n.baseBranch,
    PROTECTED_BRANCHES: n.protectedBranches.map((b) => `\`${b}\``).join(', ') || 'none',
    PROTECTED_FILES_LIST: md(n.protectedFiles, '- none yet (add globs to `protectedFiles` in `.agents/config.json`)'),
    WORK_MODE: n.workMode,
    WORK_MODE_RULE: isWt
      ? 'Worktree mode: every writing agent works in its own git worktree and branch. The shared `.agents/` folder lives in the main checkout.'
      : 'Shared mode: agents share one checkout. Claim files before editing, stage explicit paths only, never `git add -A`.',
    STATE_SYNC: n.stateSync,
    STATE_SYNC_RULE:
      n.stateSync === 'git'
        ? 'State files are committed. Pull before reading them, commit them with the work they describe.'
        : n.stateSync === 'folder'
          ? 'State and messages live in the synced folder set as `sharedDir` in `.agents/config.json`.'
          : 'State files stay on this machine (gitignored). Copy the hand-off note when you move machines.',
    OWNERS_TABLE: ownersTable,
    DEFAULT_OWNER: n.defaultOwner,
    TIMEZONE: n.timezone,
    COMMIT_RULE:
      n.commitPolicy === 'agent-may-commit'
        ? 'Agents may commit finished, verified work on a non-protected branch. Pushing needs a human request.'
        : 'Agents commit or push only when a human asks in that session.',
    SOURCE_DIRS: n.sourceDirs,
    PRESET: n.preset,
    PROTECTED_FILES_INLINE: n.protectedFiles.length ? n.protectedFiles.map((f) => `\`${f}\``).join(', ') : 'none listed (add globs to `protectedFiles` in `.agents/config.json`)',
    DATE: new Date().toISOString().slice(0, 10),
  };
}

function render(text, v) {
  return text.replace(/\r\n/g, '\n').replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => (k in v ? v[k] : m));
}

function walk(dir, base = dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full, base));
    else out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out;
}

// A project may already keep a doc under another path (docs/core/architecture.md). Find it by
// file name, any case, in the repo root or docs/, so init links to it instead of adding a twin.
function findExistingDoc(target, rel) {
  const name = path.basename(rel).toLowerCase();
  const skip = new Set(['node_modules', '.git', 'vendor', 'dist', 'build']);
  const search = (dir, depth) => {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_) {
      return null;
    }
    for (const e of entries) if (e.isFile() && e.name.toLowerCase() === name) return path.join(dir, e.name);
    if (depth === 0) return null;
    for (const e of entries) {
      if (!e.isDirectory() || skip.has(e.name)) continue;
      const hit = search(path.join(dir, e.name), depth - 1);
      if (hit) return hit;
    }
    return null;
  };
  const rootHit = search(target, 0);
  const hit = rootHit || search(path.join(target, 'docs'), 4);
  return hit ? path.relative(target, hit).split(path.sep).join('/') : null;
}

function ensureGitignore(target, lines, dry) {
  const file = path.join(target, '.gitignore');
  let text = '';
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (_) {}
  const missing = lines.filter((l) => !text.split('\n').includes(l));
  if (!missing.length) return [];
  if (!dry) fs.writeFileSync(file, text + (text && !text.endsWith('\n') ? '\n' : '') + '\n# agent workflow kit\n' + missing.join('\n') + '\n');
  return missing;
}

function init(opts) {
  const target = path.resolve(opts.target || '.');
  const raw = opts.answers ? JSON.parse(fs.readFileSync(path.resolve(opts.answers), 'utf8')) : {};
  raw.target = target;
  if (opts.preset) raw.preset = opts.preset;
  const n = normalise(raw);
  const v = vars(n);
  const dry = Boolean(opts['dry-run']);
  const report = { target, written: [], kept: [], existing: [], gitignore: [] };

  if (opts.tools) n.tools = list(opts.tools, TOOLS).filter((t) => TOOLS.includes(t));
  if (opts['with-git-hooks']) n.gitHooks = true;
  const sources = walk(TEMPLATES).map((rel) => [path.join(TEMPLATES, rel), rel]);
  for (const tool of n.tools) {
    const dir = path.join(ADAPTERS, tool);
    if (fs.existsSync(dir)) sources.push(...walk(dir).map((rel) => [path.join(dir, rel), rel]));
  }
  const edition = presets.get(n.preset);
  const COMPACT_SKIP = /^(docs\/context\/|\.claude\/rules\/|\.agents\/BUGS\.md$)/;
  if (edition.compact) {
    for (let i = sources.length - 1; i >= 0; i--) if (COMPACT_SKIP.test(sources[i][1])) sources.splice(i, 1);
    const at = sources.findIndex(([, rel]) => rel === 'AGENTS.md');
    if (at !== -1) sources[at] = [path.join(KIT, 'templates', 'presets', 'AGENTS.compact.md'), 'AGENTS.md'];
    n.gitHooks = true;
  }
  if (opts['with-optional']) sources.push(...walk(OPTIONAL).map((rel) => [path.join(OPTIONAL, rel), rel]));
  sources.push([path.join(KIT, 'scripts', 'agent-msg.js'), '.agents/tools/msg.js']);
  sources.push([path.join(KIT, 'scripts', 'agent-budget.js'), '.agents/tools/budget.js']);
  sources.push([path.join(KIT, 'scripts', 'agent-loop.js'), '.agents/tools/loop.js']);
  sources.push([path.join(KIT, 'scripts', 'lib', 'triage-auto.js'), '.agents/tools/lib/triage-auto.js']);
  sources.push([path.join(KIT, 'scripts', 'lib', 'config.js'), '.agents/tools/lib/config.js']);
  sources.push([path.join(KIT, 'scripts', 'lib', 'budget.js'), '.agents/tools/lib/budget.js']);
  sources.push([path.join(KIT, 'scripts', 'lib', 'presets.js'), '.agents/tools/lib/presets.js']);
  if (n.gitHooks) {
    sources.push([path.join(KIT, 'scripts', 'git-guard.js'), '.agents/tools/git-guard.js']);
    sources.push([path.join(KIT, 'scripts', 'lib', 'secrets.js'), '.agents/tools/lib/secrets.js']);
  }

  const COMPACT_POINTER = ['# Agent instructions', '', '`AGENTS.md` has the rules for this project.', '', '@AGENTS.md', ''].join('\n');
  const links = [];
  for (const [, rel] of sources) {
    const out = rel.replace(/\.tmpl$/, '');
    if (!/^docs\/context\/[^/]+\.md$/.test(out) || /README\.md$/i.test(out)) continue;
    const found = findExistingDoc(target, out);
    if (found && found.toLowerCase() !== out.toLowerCase()) {
      report.existing.push({ file: out, found });
      links.push([out, found]);
    }
  }
  const relink = (text) =>
    links.reduce((t, [from, to]) => {
      const name = path.basename(from).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return t.replace(new RegExp(`(?<![\\w/.-])(?:docs/context/)?${name}`, 'g'), to);
    }, text);

  for (const [src, rel] of sources) {
    const dest = path.join(target, rel.replace(/\.tmpl$/, ''));
    const relOut = path.relative(target, dest).split(path.sep).join('/');
    if (links.some(([from]) => from === relOut)) continue;
    if (fs.existsSync(dest) && !opts.force) {
      report.kept.push(relOut);
      continue;
    }
    if (!dry) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      let text = render(fs.readFileSync(src, 'utf8'), v);
      if (edition.compact && /(^|\/)(CLAUDE|GEMINI)\.md$|copilot-instructions\.md$|agent-workflow\.mdc$/.test(relOut)) text = relOut.endsWith('.mdc') ? '---\ndescription: Project rules\nalwaysApply: true\n---\n\nRead `AGENTS.md` first; its rules apply to every change.\n' : COMPACT_POINTER;
      fs.writeFileSync(dest, /\.(md|mdc|toml)$/.test(dest) ? relink(text) : text);
    }
    report.written.push(relOut);
  }

  // Agent definitions for tools that have an agents folder, generated from agents/*.md.
  for (const { rel, text } of edition.compact ? [] : renderFor(n.tools.filter((t) => t !== 'claude'))) {
    const dest = path.join(target, rel);
    if (fs.existsSync(dest) && !opts.force) {
      report.kept.push(rel);
      continue;
    }
    if (!dry) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, text);
    }
    report.written.push(rel);
  }

  if (n.gitHooks) {
    for (const [rel, body] of Object.entries(GIT_HOOKS)) {
      const dest = path.join(target, rel);
      if (fs.existsSync(dest) && !opts.force) {
        report.kept.push(rel);
        continue;
      }
      if (!dry) {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, body, { mode: 0o755 });
      }
      report.written.push(rel);
    }
    report.next = ['Turn the git hooks on (changes this repo\'s git config): git config core.hooksPath .githooks'];
  }

  const config = {
    version: 1,
    workMode: n.workMode,
    stateSync: n.stateSync,
    sharedDir: n.sharedDir,
    baseBranch: n.baseBranch,
    protectedBranches: n.protectedBranches,
    protectedFiles: n.protectedFiles,
    commitPolicy: n.commitPolicy,
    staging: 'explicit',
    destructiveDb: 'deny',
    secretScan: { allowPaths: [] },
    commands: n.commands,
    preset: n.preset,
    limits: { ...DEFAULT_LIMITS, ...edition.limits },
    timezone: n.timezone,
    tools: n.tools,
  };
  const cfgFile = path.join(target, '.agents', 'config.json');
  if (fs.existsSync(cfgFile) && !opts.force) report.kept.push('.agents/config.json');
  else {
    if (!dry) {
      fs.mkdirSync(path.dirname(cfgFile), { recursive: true });
      fs.writeFileSync(cfgFile, JSON.stringify(config, null, 2) + '\n');
    }
    report.written.push('.agents/config.json');
  }
  report.preset = n.preset;
  if (edition.compact && edition.skills) {
    const { exportSkills } = require('./export-skills');
    const to = ['agents'].concat(n.tools.includes('claude') ? ['claude'] : []).join(',');
    if (!dry) {
      const ex = exportSkills({ target, to, skills: edition.skills.join(',') });
      report.written.push(...ex.written);
      report.kept.push(...ex.kept);
    } else report.written.push(...edition.skills.map((sk) => `.agents/skills/${sk}`));
    report.next = (report.next || []).concat(['This edition uses the exported skills and git hooks instead of the plugin: do not enable the plugin for the lowest always-loaded cost (the plugin lists every skill, about 3.8k tokens).']);
  }

  const ignore = ['.agents/LOG.md', '.agents/.read/', '.agents/.budget/', '.agents/.loops/', '.agents/.gate/'];
  if (n.stateSync !== 'git') ignore.push('.agents/STATE.md', '.agents/HANDOFF.md', '.agents/BUGS.md');
  report.gitignore = ensureGitignore(target, ignore, dry);
  return report;
}

if (require.main === module) {
  const opts = args(process.argv.slice(2));
  if (opts.help || !opts.target) {
    process.stdout.write('Usage: node init-project.js --target <dir> [--answers answers.json] [--tools claude,codex,cursor,gemini,copilot] [--preset lite|low-tokens|normal|best] [--with-git-hooks] [--with-optional] [--force] [--dry-run]\n');
    process.exit(opts.help ? 0 : 1);
  }
  const finish = (o) => process.stdout.write(JSON.stringify(init(o), null, 2) + '\n');
  if (!opts.preset && !opts.answers && process.stdin.isTTY && process.stdout.isTTY) {
    // Install-time question: which edition?
    const rl = require('readline').createInterface({ input: process.stdin, output: process.stderr });
    const names = presets.NAMES;
    process.stderr.write('\nWhich edition?\n' + names.map((k, i) => `  ${i + 1}) ${k}${k === presets.DEFAULT_PRESET ? ' (default)' : ''}: ${presets.PRESETS[k].pitch}`).join('\n') + '\n');
    rl.question('Choose 1-' + names.length + ' [' + (names.indexOf(presets.DEFAULT_PRESET) + 1) + ']: ', (ans) => {
      rl.close();
      opts.preset = names[Number(ans) - 1] || presets.pick(ans) || presets.DEFAULT_PRESET;
      finish(opts);
    });
  } else finish(opts);
}

module.exports = { init, normalise, vars, render, TOOLS };
