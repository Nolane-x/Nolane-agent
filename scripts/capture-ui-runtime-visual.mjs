#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const STATES = Object.freeze([
  Object.freeze({ id: 'onboarding', route: '/onboarding', selector: '.onboarding-shell' }),
  Object.freeze({ id: 'home', route: '/', selector: '.home-view' }),
  Object.freeze({ id: 'home-nocturne', route: '/', selector: '.home-view' }),
  Object.freeze({ id: 'projects', route: '/projects', selector: '.projects-page' }),
  Object.freeze({ id: 'settings', route: '/settings', selector: '#workspace' }),
  Object.freeze({ id: 'workroom', route: '/workroom', selector: '.workroom-view' }),
  Object.freeze({ id: 'control-plane', route: '/control-plane', selector: '#workspace' }),
]);

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function required(value, name) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new TypeError(`${name} is required`);
  return normalized;
}

function stateUrl(baseUrl, token, route) {
  const target = new URL(baseUrl);
  target.searchParams.set('token', token);
  target.hash = route;
  return target.toString();
}

function statesFromEnvironment(value) {
  if (!String(value ?? '').trim()) return STATES;
  const requested = new Set(String(value).split(',').map((item) => item.trim()).filter(Boolean));
  const selected = STATES.filter((state) => requested.has(state.id));
  if (selected.length !== requested.size) throw new TypeError('NOLANE_UI_VISUAL_STATES contains an unknown state');
  return selected;
}

async function previousCaptures(output) {
  try {
    const value = JSON.parse(await readFile(path.join(output, 'receipt.json'), 'utf8'));
    return Array.isArray(value?.captures) ? value.captures : [];
  } catch {
    return [];
  }
}

export async function captureUiRuntimeVisual({ baseUrl, token, outputDirectory, states = STATES } = {}) {
  const root = required(baseUrl, 'baseUrl');
  const credential = required(token, 'token');
  const output = path.resolve(required(outputDirectory, 'outputDirectory'));
  await mkdir(output, { recursive: true });
  const prior = await previousCaptures(output);
  const browser = await chromium.launch({ headless: true });
  const captures = [];
  try {
    for (const state of states) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(String(error?.message ?? error)));
      await page.goto(stateUrl(root, credential, state.route), { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.locator(state.selector).waitFor({ state: 'visible', timeout: 30_000 });
      await page.waitForTimeout(400);
      if (pageErrors.length) throw new Error(`${state.id} emitted page errors: ${pageErrors.join(' | ')}`);
      const filename = `${state.id}.png`;
      const file = path.join(output, filename);
      await page.screenshot({ path: file, fullPage: true, animations: 'disabled' });
      const body = await readFile(file);
      captures.push(Object.freeze({ id: state.id, route: state.route, file: filename, bytes: body.length, sha256: sha256(body) }));
      await page.close();
    }
  } finally {
    await browser.close();
  }
  const byId = new Map([...prior, ...captures].map((capture) => [capture.id, capture]));
  const report = Object.freeze({
    schema: 'nolane.ui.runtime-visual-receipt.v1',
    viewport: Object.freeze({ width: 1440, height: 1000, deviceScaleFactor: 1 }),
    captures: Object.freeze(STATES.flatMap((state) => byId.has(state.id) ? [byId.get(state.id)] : [])),
  });
  const receiptSha256 = sha256(JSON.stringify(report));
  await writeFile(path.join(output, 'receipt.json'), `${JSON.stringify({ ...report, receiptSha256 }, null, 2)}\n`);
  return Object.freeze({ output, captures, receiptSha256 });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) captureUiRuntimeVisual({
  baseUrl: process.env.NOLANE_UI_RUNTIME_URL,
  token: process.env.NOLANE_AGENT_TOKEN,
  outputDirectory: process.env.NOLANE_UI_VISUAL_OUTPUT,
  states: statesFromEnvironment(process.env.NOLANE_UI_VISUAL_STATES),
}).then((result) => console.log(JSON.stringify({ captures: result.captures.length, receiptSha256: result.receiptSha256 }))).catch((error) => {
  console.error(error.stack ?? error);
  process.exitCode = 1;
});
