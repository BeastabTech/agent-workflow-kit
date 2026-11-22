#!/usr/bin/env node
'use strict';
/**
 * Command line entry of the npm package. Each command runs one of the kit's scripts on the current
 * folder (or --target <dir>), so a project needs no clone of the kit:
 *
 *   npx <package> init [--preset normal] [--tools claude,codex,...] [--answers a.json] [--with-git-hooks] [--dry-run]
 *   npx <package> export-skills [--to agents,codex,cursor,gemini,claude]
 *   npx <package> remove [--yes] [--force]
 *   npx <package> version
 *
 * The scripts stay the single implementation; this file only routes to them.
 */
const path = require('path');
const { spawnSync } = require('child_process');

const SCRIPTS = path.resolve(__dirname, '..', 'scripts');
const COMMANDS = {
  init: ['init-project.js', 'Set the workflow up in a project (writes AGENTS.md, rules, .agents/, .gitignore lines)'],
  'export-skills': ['export-skills.js', 'Copy the skills to the folders other agent tools read'],
  remove: ['remove-project.js', 'Remove what init wrote; shows the list first, deletes only with --yes'],
};

function help() {
  const { name, version } = require('../package.json');
  const lines = Object.entries(COMMANDS).map(([cmd, [, what]]) => `  ${cmd.padEnd(14)} ${what}`);
  process.stdout.write(`${name} ${version}\n\nUsage: npx ${name} <command> [options]\n\n${lines.join('\n')}\n  ${'version'.padEnd(14)} Print the version\n\nEvery command works on the current folder unless you pass --target <dir>.\nDocs: https://github.com/BeastabTech/agent-workflow-kit/blob/production/docs/INSTALL.md\n`);
}

const [cmd, ...rest] = process.argv.slice(2);
if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
  help();
  process.exit(0);
}
if (cmd === 'version' || cmd === '--version' || cmd === '-v') {
  process.stdout.write(require('../package.json').version + '\n');
  process.exit(0);
}
if (!COMMANDS[cmd]) {
  process.stderr.write(`Unknown command "${cmd}".\n\n`);
  help();
  process.exit(1);
}
const args = rest.includes('--target') || rest.includes('--help') ? rest : ['--target', process.cwd(), ...rest];
const r = spawnSync(process.execPath, [path.join(SCRIPTS, COMMANDS[cmd][0]), ...args], { stdio: 'inherit' });
process.exit(r.status === null ? 1 : r.status);
