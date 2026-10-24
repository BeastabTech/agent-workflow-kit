'use strict';
/**
 * High-confidence credential patterns. Only clear matches block; the generic
 * "key = long string" rule asks instead. A line containing `awk-allow-secret` is skipped.
 */
const BLOCK = [
  ['AWS access key id', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['private key block', /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----/],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b/],
  ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['Stripe live key', /\b(?:sk|rk)_live_[0-9A-Za-z]{20,}\b/],
  ['Anthropic API key', /\bsk-ant-[A-Za-z0-9_-]{20,}\b/],
  ['OpenAI API key', /\bsk-(?:proj-)?[A-Za-z0-9_-]{40,}\b/],
  ['GCP service account key', /"private_key_id"\s*:\s*"[a-f0-9]{40}"/],
  ['npm token', /\bnpm_[A-Za-z0-9]{36}\b/],
];

const ASK = [
  [
    'hard-coded secret value',
    /\b(?:password|passwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret)\b["']?\s*[:=]\s*["'][^"'\s]{12,}["']/i,
  ],
  ['URL with inline credentials', /\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:[^\s:/@]{6,}@[^\s/]+/i],
];

const PLACEHOLDER = /(example|placeholder|changeme|your[_-]|<[^>]+>|\$\{|xxxx|dummy|sample|test[_-]?(?:key|secret|token))/i;

function scanLines(lines) {
  const block = [];
  const ask = [];
  for (const { file, line, text } of lines) {
    if (!text || text.includes('awk-allow-secret')) continue;
    for (const [name, re] of BLOCK) {
      if (re.test(text)) block.push({ file, line, name });
    }
    for (const [name, re] of ASK) {
      if (re.test(text) && !PLACEHOLDER.test(text)) ask.push({ file, line, name });
    }
  }
  return { block, ask };
}

function scanText(text, file) {
  const lines = String(text || '')
    .split('\n')
    .map((t, i) => ({ file, line: i + 1, text: t }));
  return scanLines(lines);
}

/** Parse a unified diff (git diff -U0) into added lines with file and line number. */
function addedLinesFromDiff(diff) {
  const out = [];
  let file = null;
  let lineNo = 0;
  for (const raw of String(diff || '').split('\n')) {
    if (raw.startsWith('+++ ')) {
      file = raw.slice(4).replace(/^b\//, '');
    } else if (raw.startsWith('@@')) {
      const m = /\+(\d+)/.exec(raw);
      lineNo = m ? Number(m[1]) : 0;
    } else if (raw.startsWith('+') && !raw.startsWith('+++')) {
      out.push({ file, line: lineNo, text: raw.slice(1) });
      lineNo++;
    }
  }
  return out;
}

const ENV_FILE = /(^|\/)\.env(\.[^/]+)?$/;
const ENV_TEMPLATE = /(^|\/)\.env\.(example|sample|template|dist|defaults)$/;

function isEnvFile(p) {
  return ENV_FILE.test(p) && !ENV_TEMPLATE.test(p);
}

module.exports = { scanLines, scanText, addedLinesFromDiff, isEnvFile };
