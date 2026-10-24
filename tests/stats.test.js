'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { sessionStats } = require('../scripts/session-stats');
const { measure } = require('../scripts/stats');
const { parseAgent } = require('../scripts/lib/agents');
const { parse } = require('../scripts/agent-msg');

const line = (o) => JSON.stringify(o);
const asst = (id, usage) => line({ type: 'assistant', requestId: id, message: { usage } });

test('session-stats: main vs sub-agents, streaming duplicates counted once, peak context', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'awk-sess-'));
  const file = path.join(dir, 's1.jsonl');
  fs.writeFileSync(file, [
    asst('r1', { input_tokens: 10, cache_creation_input_tokens: 1000, cache_read_input_tokens: 0, output_tokens: 5 }),
    asst('r1', { input_tokens: 10, cache_creation_input_tokens: 1000, cache_read_input_tokens: 0, output_tokens: 50 }), // same request, later chunk
    asst('r2', { input_tokens: 4, cache_creation_input_tokens: 100, cache_read_input_tokens: 1000, output_tokens: 20 }),
    'not json',
    line({ type: 'user' }),
  ].join('\n'));
  fs.mkdirSync(path.join(dir, 's1', 'subagents'), { recursive: true });
  fs.writeFileSync(path.join(dir, 's1', 'subagents', 'agent-a.jsonl'), asst('x', { input_tokens: 1, cache_creation_input_tokens: 200, cache_read_input_tokens: 0, output_tokens: 9 }));
  const s = sessionStats(file);
  assert.equal(s.main.turns, 2);
  assert.equal(s.main.output, 70);
  assert.equal(s.main.peakContext, 1104);
  assert.equal(s.freshMain, 10 + 1000 + 50 + 4 + 100 + 20);
  assert.equal(s.sub.count, 1);
  assert.equal(s.freshSub, 210);
  assert.equal(s.freshTotal, s.freshMain + 210);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('stats: measures the real kit and the index beats reading everything', () => {
  const m = measure();
  assert.ok(m.skills >= 36 && m.agents >= 9);
  assert.ok(m.alwaysOnTokens > 0 && m.alwaysOnTokens < 10000, 'always-loaded cost stays small');
  assert.ok(m.coldStartWithIndex < m.coldStartReadEverything);
});

test('CRLF checkouts (Windows autocrlf) still parse agents and the message log', () => {
  const agent = parseAgent('---\r\nname: x\r\ndescription: Use when y\r\n---\r\n\r\nBody line\r\n');
  assert.equal(agent.meta.name, 'x');
  assert.equal(agent.body, 'Body line');
  const msgs = parse('# log\r\n\r\n### 2026-01-01T00:00:00.000Z · from a · to b · note\r\nTopic: t\r\nStatus: open\r\n\r\nhi\r\n');
  assert.equal(msgs.length, 1);
  assert.equal(msgs[0].topic, 't');
  assert.equal(msgs[0].type, 'note');
});
