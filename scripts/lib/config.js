'use strict';
/**
 * Loads the kit settings for a project.
 * Team settings come from <project>/.agents/config.json (committed).
 * Personal settings come from the plugin options (CLAUDE_PLUGIN_OPTION_*).
 * Env switches: AWK_HOOKS=off disables every hook; AWK_DISABLE=check1,check2 disables single checks.
 */
const fs = require('fs');
const presets = require('./presets');
const path = require('path');
const { execFileSync } = require('child_process');

const DEFAULTS = {
  version: 1,
  workMode: 'shared',
  stateSync: 'git',
  sharedDir: null,
  baseBranch: 'main',
  protectedBranches: ['main', 'master', 'production', 'prod', 'release'],
  protectedFiles: [],
  commitPolicy: 'on-request',
  staging: 'explicit',
  destructiveDb: 'deny',
  secretScan: { allowPaths: [] },
  commands: {},
  limits: {},
};

// minimal keeps only the clear safety nets; strict turns warnings and soft asks into hard stops.
const PROFILES = ['minimal', 'standard', 'strict'];
const REPLY_STYLES = ['normal', 'caveman-lite', 'caveman-full'];
const MINIMAL_OFF = new Set(['explicit-staging', 'protected-branch', 'protected-files', 'env-files', 'agent-budget']);

function git(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 8000 }).trim();
  } catch (_) {
    return '';
  }
}

function projectRoot(cwd) {
  return git(['rev-parse', '--show-toplevel'], cwd) || cwd;
}

/** Root of the main checkout, so every worktree shares one .agents folder. */
function sharedRoot(cwd) {
  const common = git(['rev-parse', '--path-format=absolute', '--git-common-dir'], cwd);
  if (common && path.basename(common) === '.git') return path.dirname(common);
  return projectRoot(cwd);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return null;
  }
}

function boolOption(name, fallback) {
  const raw = process.env[`CLAUDE_PLUGIN_OPTION_${name}`];
  if (raw === undefined || raw === '') return fallback;
  return !/^(false|0|no|off)$/i.test(String(raw).trim());
}

function loadConfig(cwd) {
  const root = projectRoot(cwd);
  const file = path.join(root, '.agents', 'config.json');
  const team = readJson(file);
  const cfg = { ...DEFAULTS, ...(team || {}) };
  cfg.secretScan = { ...DEFAULTS.secretScan, ...((team && team.secretScan) || {}) };
  cfg.root = root;
  cfg.hasTeamConfig = Boolean(team);
  cfg.disabled = new Set(
    String(process.env.AWK_DISABLE || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
  cfg.preset = presets.pick(process.env.AWK_PRESET, process.env.CLAUDE_PLUGIN_OPTION_PRESET, cfg.preset) || presets.DEFAULT_PRESET;
  const preset = presets.get(cfg.preset);
  cfg.limits = { ...preset.limits, ...((team && team.limits) || {}) };
  const wanted = String(process.env.AWK_PROFILE || process.env.CLAUDE_PLUGIN_OPTION_PROFILE || (team && team.profile) || '').trim().toLowerCase();
  cfg.profile = PROFILES.includes(wanted) ? wanted : preset.profile;
  cfg.hooksOff = /^(off|false|0)$/i.test(String(process.env.AWK_HOOKS || '')) || !boolOption('HOOKS_ENABLED', true);
  const replyWanted = String(process.env.CLAUDE_PLUGIN_OPTION_REPLY_STYLE || '').trim().toLowerCase();
  cfg.personal = {
    blockAiTrailers: boolOption('BLOCK_AI_TRAILERS', true),
    secretScan: boolOption('SECRET_SCAN', true),
    destructiveDbGuard: boolOption('DESTRUCTIVE_DB_GUARD', true),
    replyStyle: REPLY_STYLES.includes(replyWanted) ? replyWanted : preset.replyStyle,
  };
  return cfg;
}

function enabled(cfg, check) {
  if (cfg.profile === 'minimal' && MINIMAL_OFF.has(check)) return false;
  return !cfg.hooksOff && !cfg.disabled.has(check);
}

module.exports = { PROFILES, DEFAULTS, git, projectRoot, sharedRoot, loadConfig, enabled, readJson };
