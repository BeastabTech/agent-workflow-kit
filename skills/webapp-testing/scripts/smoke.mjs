#!/usr/bin/env node
// Smoke-check pages of a running web app with Playwright.
// Usage: node smoke.mjs <base-url> [path ...]
// Fails (exit 1) on console errors, page errors or failed requests (status >= 400).
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  try {
    playwright = require(require.resolve('playwright', { paths: [process.cwd()] }));
  } catch {
    console.error('Playwright not found. Run: npm i -D playwright && npx playwright install chromium');
    process.exit(2);
  }
}

const [base, ...paths] = process.argv.slice(2);
if (!base) {
  console.error('Usage: node smoke.mjs <base-url> [path ...]');
  process.exit(2);
}
const targets = paths.length ? paths : ['/'];
const sizes = [
  { name: 'phone', width: 375, height: 812 },
  { name: 'desktop', width: 1280, height: 800 },
];
mkdirSync('.webapp-smoke', { recursive: true });

const browser = await playwright.chromium.launch();
let failed = 0;
for (const size of sizes) {
  const page = await browser.newPage({ viewport: { width: size.width, height: size.height } });
  for (const p of targets) {
    const problems = [];
    const onConsole = (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`);
    const onPageError = (e) => problems.push(`pageerror: ${e.message}`);
    const onResponse = (r) => r.status() >= 400 && problems.push(`http ${r.status()}: ${r.url()}`);
    page.on('console', onConsole);
    page.on('pageerror', onPageError);
    page.on('response', onResponse);
    const url = new URL(p, base).toString();
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    } catch (e) {
      problems.push(`navigation: ${e.message.split('\n')[0]}`);
    }
    const shot = `.webapp-smoke/${size.name}${p.replace(/[^\w]+/g, '_') || '_root'}.png`;
    await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1).catch(() => false);
    if (overflow) problems.push('layout: horizontal scroll');
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
    page.off('response', onResponse);
    const status = problems.length ? 'FAIL' : 'ok  ';
    if (problems.length) failed++;
    console.log(`${status} ${size.name.padEnd(7)} ${url}  (${shot})`);
    for (const pr of problems.slice(0, 10)) console.log(`       - ${pr}`);
  }
  await page.close();
}
await browser.close();
console.log(failed ? `\n${failed} page check(s) failed` : '\nall page checks passed');
process.exit(failed ? 1 : 0);
