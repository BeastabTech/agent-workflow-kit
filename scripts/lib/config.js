'use strict';
/**
 * Loads the kit settings for a project.
 * Team settings come from <project>/.agents/config.json (committed).
 * Personal settings come from the plugin options (CLAUDE_PLUGIN_OPTION_*).
 * Env switches: AWK_HOOKS=off disables every hook; AWK_DISABLE=check1,check2 disables single checks.
 *
 * Order for every setting: environment or plugin option, then the team file, then the edition
 * (lib/presets.js), then DEFAULTS below. A missing or broken team file is not an error: the defaults
 * apply and hasTeamConfig is false, which turns off the checks that only make sense for a set-up project.
 * Also here: localDir(), the one place that creates the kit's machine-local state folders.
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
  // How the team merges, as the user decided it (git-workflow skill, "Merge a feature into another branch").
  // noBackMerge: branches that run ahead (dev, staging) and must never be merged, pulled or rebased into
  // a feature branch; conflicts with them are resolved on a branch cut from the target instead.
  mergeFlow: { noBackMerge: [], integrationPrefix: 'integrate/', notes: [] },
  planGate: true, // worker sub-agents ask the human until .agents/PLAN.md says Status: approved
};

// minimal keeps only the clear safety nets; strict turns warnings and soft asks into hard stops.
const PROFILES = ['minimal', 'standard', 'strict'];
const REPLY_STYLES = ['normal', 'caveman-lite', 'caveman-full'];
const MINIMAL_OFF = new Set(['done-gate', 'explicit-staging', 'protected-branch', 'protected-files', 'env-files', 'agent-budget', 'plan-gate', 'machine-check', 'back-merge']);

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
  cfg.mergeFlow = { ...DEFAULTS.mergeFlow, ...((team && team.mergeFlow) || {}) };
  if (!Array.isArray(cfg.mergeFlow.noBackMerge)) cfg.mergeFlow.noBackMerge = [];
  cfg.planGate = !/^(false|0|no|off)$/i.test(String(cfg.planGate));
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

/**
 * Create a folder for the kit's machine-local state (.agents/.budget, .gate, .loops) and make it ignore
 * itself: a .gitignore holding `*` inside it. The hooks run in every repository, also ones where `init`
 * never added the kit's lines to the project's .gitignore, and local state must never show up in
 * `git status` or get committed. Returns the folder.
 */
function localDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const ignore = path.join(dir, '.gitignore');
  if (!fs.existsSync(ignore)) fs.writeFileSync(ignore, '*\n');
  return dir;
}

function enabled(cfg, check) {
  if (cfg.profile === 'minimal' && MINIMAL_OFF.has(check)) return false;
  return !cfg.hooksOff && !cfg.disabled.has(check);
}

module.exports = { PROFILES, DEFAULTS, git, projectRoot, sharedRoot, loadConfig, enabled, readJson, localDir };
