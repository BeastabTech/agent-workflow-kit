#!/usr/bin/env node
'use strict';
/**
 * Remove the kit from a project: the reverse of init-project.js.
 *
 *   remove-project.js --target <dir>            show what would be removed (changes nothing)
 *   remove-project.js --target <dir> --yes      remove it
 *   remove-project.js --target <dir> --yes --force   also remove kit files that were edited since
 *
 * What it does, from the install manifest (.agents/kit-manifest.json, written by init):
 *   - deletes each file the kit wrote, if it is still byte-for-byte what the kit wrote;
 *   - keeps a file somebody edited (your AGENTS.md, a filled-in STATE.md) and lists it, unless --force;
 *   - deletes the kit's machine-local state (.agents/.budget, .gate, .loops, .read);
 *   - takes the kit's lines out of .gitignore;
 *   - removes folders that are empty afterwards, then the manifest itself.
 * It never touches a file the kit did not write. It does not change git config: if the git hooks
 * were turned on, run `git config --unset core.hooksPath` yourself.
 *
 * A project set up by a kit version before the manifest existed has none: the command then lists the
 * kit's usual paths and removes nothing, except with --force the kit-only tool folders.
 */
const fs = require('fs');
const path = require('path');
const M = require('./lib/manifest');

const LOCAL_STATE = ['.agents/.budget', '.agents/.gate', '.agents/.loops', '.agents/.read'];
/** Folders that hold nothing but kit copies; safe to delete whole when there is no manifest and --force is given. */
const KIT_ONLY = ['.agents/tools', '.agents/skills'];
const USUAL = ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md', '.agents', '.claude/rules', 'docs/context', '.githooks', '.codex/agents', '.cursor/rules/agent-workflow.mdc', '.cursor/agents', '.github/copilot-instructions.md'];

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[argv[i].slice(2)] = true;
    else out[argv[i].slice(2)] = argv[++i];
  }
  return out;
}

/** Delete now-empty parent folders of `rel`, walking up, never above the project root. */
function pruneUp(target, rel) {
  let dir = path.dirname(path.join(target, rel));
  while (dir.startsWith(target + path.sep)) {
    try {
      fs.rmdirSync(dir); // fails when not empty: that ends the walk
    } catch (_) {
      return;
    }
    dir = path.dirname(dir);
  }
}

/** Take the kit's lines (and its header comment) out of .gitignore. Returns the lines removed. */
function cleanGitignore(target, lines, apply) {
  const file = path.join(target, '.gitignore');
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (_) {
    return [];
  }
  const drop = new Set([...lines, '# agent workflow kit']);
  const kept = text.split('\n').filter((l) => !drop.has(l.replace(/\r$/, '')));
  const removed = text.split('\n').filter((l) => lines.includes(l.replace(/\r$/, '')));
  if (apply && removed.length) {
    const out = kept.join('\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '').replace(/\n+$/, ''); // no blank block left where the kit's lines were
    if (out.trim()) fs.writeFileSync(file, out + '\n');
    else fs.unlinkSync(file); // the kit created it and nothing else is in it
  }
  return removed;
}

function remove(opts) {
  const target = path.resolve(opts.target || '.');
  const apply = Boolean(opts.yes);
  const force = Boolean(opts.force);
  const report = { target, applied: apply, removed: [], keptEdited: [], missing: [], localState: [], gitignore: [], notes: [] };
  // A path in the manifest must stay inside the project: a hand-edited manifest must not delete anything else.
  const inside = (rel) => !path.isAbsolute(rel) && !rel.split(/[\\/]/).includes('..');

  const manifest = M.read(target);
  if (!manifest) {
    const found = USUAL.filter((p) => fs.existsSync(path.join(target, p)));
    report.notes.push('No install manifest (.agents/kit-manifest.json): this project was set up by a kit version before 0.5.0, or the kit is not installed here.');
    if (found.length) report.notes.push(`Kit paths found: ${found.join(', ')}. Review and delete them by hand; --yes --force removes only the kit-only folders (${KIT_ONLY.join(', ')}).`);
    if (force) {
      for (const dir of KIT_ONLY) {
        if (!fs.existsSync(path.join(target, dir))) continue;
        if (apply) fs.rmSync(path.join(target, dir), { recursive: true, force: true });
        report.removed.push(dir + '/');
      }
    }
  } else {
    for (const [rel, hash] of Object.entries(manifest.files)) {
      const abs = path.join(target, rel);
      if (!inside(rel)) continue;
      if (!fs.existsSync(abs)) {
        report.missing.push(rel);
        continue;
      }
      if (M.hashFile(abs) !== hash && !force) {
        report.keptEdited.push(rel);
        continue;
      }
      if (apply) {
        fs.unlinkSync(abs);
        pruneUp(target, rel);
      }
      report.removed.push(rel);
    }
    report.gitignore = cleanGitignore(target, manifest.gitignore, apply);
  }

  for (const dir of LOCAL_STATE) {
    if (!fs.existsSync(path.join(target, dir))) continue;
    if (apply) fs.rmSync(path.join(target, dir), { recursive: true, force: true });
    report.localState.push(dir + '/');
  }
  if (manifest && apply) {
    // Keep the manifest while edited files remain, so a later run can still finish the job.
    if (report.keptEdited.length) {
      const left = Object.fromEntries(report.keptEdited.map((rel) => [rel, manifest.files[rel]]));
      fs.writeFileSync(path.join(target, M.MANIFEST), JSON.stringify({ version: manifest.version, files: left, gitignore: [] }, null, 2) + '\n');
    } else {
      fs.rmSync(path.join(target, M.MANIFEST), { force: true });
      pruneUp(target, M.MANIFEST);
    }
  }
  if (report.keptEdited.length) report.notes.push('Kept because they were edited after the kit wrote them. Delete them yourself, or run again with --force.');
  if (fs.existsSync(path.join(target, '.agents', 'LOG.md'))) report.notes.push('.agents/LOG.md (the message log) is yours and was left in place.');
  if (!apply) report.notes.push('Nothing was changed. Run again with --yes to remove.');
  else report.notes.push('If the git hooks were on: git config --unset core.hooksPath. Claude Code plugin: claude plugin uninstall agent-workflow-kit@agent-workflow-kit.');
  return report;
}

if (require.main === module) {
  const opts = args(process.argv.slice(2));
  if (opts.help) {
    process.stdout.write('Usage: remove-project.js [--target <dir>] [--yes] [--force]\n  Without --yes it only shows what would be removed.\n');
    process.exit(0);
  }
  try {
    process.stdout.write(JSON.stringify(remove(opts), null, 2) + '\n');
  } catch (e) {
    process.stderr.write(`remove: ${e.message}\n`);
    process.exit(1);
  }
}

module.exports = { remove };
