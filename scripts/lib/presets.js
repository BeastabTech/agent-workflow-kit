'use strict';
/**
 * Presets ("editions"): one choice at install time that sets how much the kit does.
 * Order of precedence for every setting: environment / plugin option, then the team's
 * .agents/config.json, then the preset, then the built-in default.
 */
const LITE_SKILLS = ['safe-change', 'self-review', 'debug', 'git-workflow', 'handoff'];
const LEAN_SKILLS = [...LITE_SKILLS, 'context-budget', 'delegate', 'plan', 'bug-intake'];

const PRESETS = {
  auto: {
    label: 'auto',
    pitch: 'The kit decides per task. It sizes the task from your words and the repo, then behaves like low-tokens for small work, normal for medium and best for big or risky work.',
    profile: 'standard',
    replyStyle: 'normal',
    limits: {},
    skills: null,
    compact: false,
    gate: { tests: true, addTests: false, maxBlocks: 1 },
    directive:
      'Preset auto: before non-trivial work, run `node .agents/tools/budget.js triage --task "<the request in one or two lines>"` (or the manager skill) and follow its mode, model tier and review. Small tasks stay solo and short; big or risky ones earn agents, a stronger model and an independent review. Repeating work (fix until green, review and fix, watch) goes through the loop skill with its hard stop.',
  },
  lite: {
    label: 'lite',
    pitch: 'Safety net only. Least overhead: secret, trailer, force-push and destructive-database guards; five core skills; no workflow ceremony.',
    profile: 'minimal',
    replyStyle: 'normal',
    limits: { maxParallel: 2, maxSpawns: 4 },
    skills: LITE_SKILLS,
    compact: true,
    gate: { tests: false, addTests: false, maxBlocks: 0 },
    directive: '',
  },
  'low-tokens': {
    label: 'low-tokens',
    pitch: 'Cheapest sessions. Short replies, no sub-agents unless a task needs wide reading, small context, nine core skills.',
    profile: 'standard',
    replyStyle: 'caveman-lite',
    limits: { maxParallel: 1, maxSpawns: 2, smallRepoFiles: 100000 },
    skills: LEAN_SKILLS,
    compact: true,
    gate: { tests: true, addTests: false, maxBlocks: 1 },
    directive:
      'Preset low-tokens: spend as few tokens as the task allows. Do the work yourself; use a sub-agent only for a search that would read dozens of files. Read file ranges, not whole files; filter long output. Keep replies and Done reports to a few lines with evidence. Never trade away a safety check to save tokens.',
  },
  normal: {
    label: 'normal',
    pitch: 'Balanced (default). Full skills and hooks; small tasks done solo, sub-agents only where they pay off, self-review before done.',
    profile: 'standard',
    replyStyle: 'normal',
    limits: {},
    skills: null,
    compact: false,
    gate: { tests: true, addTests: false, maxBlocks: 1 },
    directive: '', // the manager, delegate and self-review skills already carry the normal behaviour
  },
  best: {
    label: 'best',
    pitch: 'Strictest. Strict hooks, a test run and a test file required before done, independent review of risky code, closeout on multi-part work. Uses more tokens.',
    profile: 'strict',
    replyStyle: 'normal',
    limits: { maxFixRounds: 3 },
    skills: null,
    compact: false,
    gate: { tests: true, addTests: true, maxBlocks: 2 },
    directive:
      'Preset best: thoroughness over tokens. (1) Before coding, list the edge cases for the change (empty, invalid, boundary, repeat, concurrent, old behaviour) and cover each with a test that fails without the change. (2) Run the real tests, type check and lint; never claim a result you did not see. (3) Before saying done, review your diff as a strict reviewer (self-review skill) and fix what you find. (4) Auth, payments, data, deletes and migrations also get an independent reviewer or security-reviewer sub-agent. (5) Work in several parts gets a closeout pass before you tell the user it is done. Small tasks stay solo; only the review is extra.',
  },
};

const DEFAULT_PRESET = 'normal';
const NAMES = Object.keys(PRESETS);

/** Pick a preset name from env, plugin option or a config value; unknown or "auto" gives ''. */
function pick(...candidates) {
  for (const c of candidates) {
    const v = String(c || '').trim().toLowerCase().replace(/[_ ]/g, '-');
    if (PRESETS[v]) return v;
    if (v === 'low' || v === 'lowtokens' || v === 'cheap') return 'low-tokens';
    if (v === 'max') return 'best';
  }
  return '';
}

function get(name) {
  return PRESETS[pick(name)] || PRESETS[DEFAULT_PRESET];
}

module.exports = { PRESETS, NAMES, DEFAULT_PRESET, LITE_SKILLS, LEAN_SKILLS, pick, get };
