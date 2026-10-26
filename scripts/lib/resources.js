'use strict';
/**
 * Machine check before spawning: free memory, CPU load and the coding-agent processes already
 * running, turned into how many agents can run at once without making the laptop (and the agent
 * app) unresponsive. Everything is read from the OS in a few milliseconds; any failure falls back
 * to Node's os module, and the caller treats a missing reading as "no machine limit".
 */
const os = require('os');
const fs = require('fs');
const { execFileSync } = require('child_process');

const MB = 1024 * 1024;

function run(cmd, args) {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000, maxBuffer: 8 * MB });
  } catch (_) {
    return '';
  }
}

/** Memory the OS can hand out now, in MB. os.freemem() undercounts on macOS (it skips cached pages). */
function availableMB() {
  if (process.platform === 'linux') {
    try {
      const m = /^MemAvailable:\s+(\d+)\s+kB/m.exec(fs.readFileSync('/proc/meminfo', 'utf8'));
      if (m) return Math.round(Number(m[1]) / 1024);
    } catch (_) {}
  }
  if (process.platform === 'darwin') {
    const out = run('vm_stat', []);
    const page = Number((/page size of (\d+) bytes/.exec(out) || [])[1]) || 4096;
    const pages = (name) => Number((new RegExp(`^Pages ${name}:\\s+(\\d+)`, 'm').exec(out) || [])[1]) || 0;
    const free = pages('free') + pages('inactive') + pages('speculative') + pages('purgeable');
    if (free) return Math.round((free * page) / MB);
  }
  return Math.round(os.freemem() / MB);
}

/**
 * Parse `ps -axo rss=,args=` output. Counts the CLI binaries `claude`, `codex` and `gemini` (case matters:
 * `Claude` inside Claude.app is the desktop app's helper processes, not a session; paths may contain spaces)
 * and the same CLIs run through node.
 */
function parseAgentPs(out) {
  let count = 0;
  let rss = 0;
  for (const line of String(out || '').split('\n')) {
    const m = /^\s*(\d+)\s+(.+)$/.exec(line);
    if (!m) continue;
    // Command and script only: everything before the first flag, so a wrapper such as
    // `disclaimer --pgroup -- /path/claude` does not count as a second session.
    const head = m[2].split(/\s+-/)[0].trim();
    const native = /(^|\/)(claude|codex|gemini)$/.test(head);
    const viaNode = /(^|\/)node(\.exe)?\s/i.test(head) && /(claude-code|@openai\/codex|gemini-cli)/i.test(head);
    if (!native && !viaNode) continue;
    count += 1;
    rss += Number(m[1]) / 1024;
  }
  return { count, rssMB: Math.round(rss) };
}

/** Running coding-agent processes (Claude Code, Codex, Gemini CLI) and their memory. */
function agentProcesses() {
  if (process.platform === 'win32') return { count: 0, rssMB: 0 };
  return parseAgentPs(run('ps', ['-axo', 'rss=,args=']));
}

/** One reading of the machine. Pass `fake` in tests to skip the OS. */
function snapshot(fake) {
  if (fake) return { ...fake };
  const procs = agentProcesses();
  return {
    cores: os.cpus().length || 1,
    load1: Math.round((os.loadavg()[0] || 0) * 10) / 10, // 0 on Windows: no CPU limit there
    totalMB: Math.round(os.totalmem() / MB),
    availMB: availableMB(),
    agentProcs: procs.count,
    agentRssMB: procs.rssMB,
  };
}

/**
 * How many agents can run at once right now. Memory: what is free minus a reserve for the OS and
 * the user's apps, divided by what one agent needs. CPU: idle cores (cores minus 1-minute load),
 * divided by what one agent needs while it runs tests and builds. The smaller one wins, capped by
 * limits.maxParallel. Pressure "high" means even one more agent is risky.
 */
function safeParallel(snap, limits) {
  const reserve = Math.max(limits.memReserveMB || 0, Math.round(snap.totalMB * 0.15));
  const perAgent = Math.max(100, limits.agentMemMB || 600);
  const memSlots = Math.floor((snap.availMB - reserve) / perAgent);
  const idle = snap.cores - snap.load1;
  const cpuSlots = snap.load1 > 0 ? Math.floor(idle / Math.max(0.25, limits.cpuPerAgent || 1)) : Infinity;
  const cap = limits.maxParallel || Infinity;
  const raw = Math.min(memSlots, cpuSlots, cap);
  const parallel = Math.max(1, Number.isFinite(raw) ? raw : snap.cores);
  const pressure = memSlots < 1 || cpuSlots < 1 ? 'high' : raw < Math.min(2, cap) ? 'medium' : 'low';
  const reasons = [];
  if (memSlots < 1) reasons.push(`only ${snap.availMB} MB free with ${reserve} MB kept for the system`);
  if (cpuSlots < 1) reasons.push(`CPU load ${snap.load1} on ${snap.cores} cores`);
  if (snap.agentProcs > 1) reasons.push(`${snap.agentProcs} agent processes already running (${snap.agentRssMB} MB)`);
  const limitedBy = raw === memSlots ? 'memory' : raw === cpuSlots ? 'cpu' : 'limit';
  return { parallel, pressure, memSlots, cpuSlots, reserveMB: reserve, limitedBy, reasons };
}

function describe(snap, fit) {
  const gb = (mb) => (mb / 1024).toFixed(1);
  const head = `Machine: ${gb(snap.availMB)} of ${gb(snap.totalMB)} GB free, load ${snap.load1} on ${snap.cores} cores, ${snap.agentProcs} agent process(es) running.`;
  const verdict =
    fit.pressure === 'high'
      ? 'Pressure HIGH: do not start agents or sessions in parallel; work solo, one step at a time, and suggest closing apps or agent sessions.'
      : `Safe to run ${fit.parallel} agent(s) at once (limited by ${fit.limitedBy}).`;
  return `${head} ${verdict}${fit.reasons.length ? ` (${fit.reasons.join('; ')})` : ''}`;
}

module.exports = { snapshot, safeParallel, describe, availableMB, agentProcesses, parseAgentPs };
