#!/usr/bin/env node
'use strict';
/**
 * PreToolUse guard for Edit / Write / MultiEdit / NotebookEdit.
 * Checks: protected-files (asks), env-files (asks), secret-scan on new content (blocks clear secrets).
 */
const path = require('path');
const { loadConfig, enabled } = require('../lib/config');
const { matchesAny } = require('../lib/glob');
const { scanText, isEnvFile } = require('../lib/secrets');
const { readInput, respondPreToolUse } = require('../lib/hook-io');

function newContent(ti) {
  if (typeof ti.content === 'string') return ti.content;
  if (typeof ti.new_string === 'string') return ti.new_string;
  if (typeof ti.new_source === 'string') return ti.new_source;
  if (Array.isArray(ti.edits)) return ti.edits.map((e) => e.new_string || '').join('\n');
  return '';
}

function main() {
  const input = readInput();
  const ti = input.tool_input || {};
  const target = ti.file_path || ti.notebook_path;
  if (!target) process.exit(0);
  const cwd = input.cwd || process.cwd();
  const cfg = loadConfig(cwd);
  if (cfg.hooksOff) process.exit(0);
  const abs = path.resolve(cwd, target);
  const rel = path.relative(cfg.root, abs).split(path.sep).join('/');
  const inside = rel && !rel.startsWith('..');
  const findings = [];

  if (inside && enabled(cfg, 'protected-files') && matchesAny(rel, cfg.protectedFiles)) {
    findings.push({
      level: 'ask',
      check: 'protected-files',
      reason: `${rel} is a protected file. Show the owner (docs/context/MODULE_MAP.md) the exact diff and wait for their OK before editing.`,
    });
  }
  const envFile = isEnvFile(rel || target);
  if (envFile && enabled(cfg, 'env-files')) {
    findings.push({ level: 'ask', check: 'env-files', reason: `${rel || target} is an env file. Never print or commit its values. Confirm this edit.` });
  }
  if (!envFile && cfg.personal.secretScan && enabled(cfg, 'secret-scan') && !matchesAny(rel, cfg.secretScan.allowPaths)) {
    const { block } = scanText(newContent(ti), rel || target);
    if (block.length) {
      findings.push({
        level: 'deny',
        check: 'secret-scan',
        reason: `New content has a possible secret (${[...new Set(block.map((b) => b.name))].join(', ')}). Read it from env or secret storage instead. False positive: add "awk-allow-secret" on that line.`,
      });
    }
  }
  respondPreToolUse(findings);
}

if (require.main === module) {
  try {
    main();
  } catch (_) {
    process.exit(0);
  }
}
