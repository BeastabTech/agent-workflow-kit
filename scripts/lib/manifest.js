'use strict';
/**
 * Install manifest: the list of files the kit wrote into a project, each with the hash of what was
 * written. `remove` uses it to delete exactly those files, and only the ones nobody edited since.
 *
 * File: <project>/.agents/kit-manifest.json
 *   { "version": "<kit version>", "files": { "<path>": "<sha256>" }, "gitignore": ["<line>", ...] }
 * Paths use forward slashes and are relative to the project root. The file is meant to be committed,
 * so a teammate can remove the kit too.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MANIFEST = '.agents/kit-manifest.json';

/** Hash of a file's bytes with line endings normalised, so a Windows checkout (autocrlf) still matches. */
function hashFile(file) {
  const text = fs.readFileSync(file).toString('latin1').replace(/\r\n/g, '\n');
  return crypto.createHash('sha256').update(text, 'latin1').digest('hex');
}

function read(target) {
  try {
    const m = JSON.parse(fs.readFileSync(path.join(target, MANIFEST), 'utf8'));
    return { version: m.version || '', files: m.files && typeof m.files === 'object' ? m.files : {}, gitignore: Array.isArray(m.gitignore) ? m.gitignore : [] };
  } catch (_) {
    return null;
  }
}

/** Every file under `rel` (a file or a folder), as project-relative forward-slash paths. */
function filesUnder(target, rel) {
  const abs = path.join(target, rel);
  let st;
  try {
    st = fs.statSync(abs);
  } catch (_) {
    return [];
  }
  if (!st.isDirectory()) return [rel.split(path.sep).join('/')];
  return fs.readdirSync(abs).flatMap((name) => filesUnder(target, path.join(rel, name)));
}

/**
 * Add what was just written to the manifest (creating it if needed). `written` may name files or
 * folders; `gitignore` are the lines the kit added to the project's .gitignore.
 */
function record(target, written, gitignore) {
  const m = read(target) || { version: '', files: {}, gitignore: [] };
  try {
    m.version = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '..', 'package.json'), 'utf8')).version;
  } catch (_) {}
  for (const rel of written || []) for (const f of filesUnder(target, rel)) if (f !== MANIFEST) m.files[f] = hashFile(path.join(target, f));
  for (const line of gitignore || []) if (!m.gitignore.includes(line)) m.gitignore.push(line);
  const file = path.join(target, MANIFEST);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const sorted = Object.fromEntries(Object.keys(m.files).sort().map((k) => [k, m.files[k]]));
  fs.writeFileSync(file, JSON.stringify({ version: m.version, files: sorted, gitignore: m.gitignore }, null, 2) + '\n');
  return m;
}

module.exports = { MANIFEST, hashFile, read, record };
