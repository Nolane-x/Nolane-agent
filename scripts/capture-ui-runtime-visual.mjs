#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';

const DEFAULT_VIEWPORT = Object.freeze({ width: 1440, height: 1000 });

const STATES = Object.freeze([
  Object.freeze({ id: 'onboarding', route: '/onboarding', selector: '.onboarding-shell' }),
  Object.freeze({ id: 'home', route: '/', selector: '.home-view' }),
  Object.freeze({ id: 'home-compact', route: '/', selector: '.home-view', viewport: Object.freeze({ width: 640, height: 900 }) }),
  Object.freeze({ id: 'home-nocturne', route: '/', selector: '.home-view' }),
  Object.freeze({ id: 'projects', route: '/projects', selector: '.projects-page' }),
  Object.freeze({ id: 'skills', route: '/skills', selector: '.skills-library' }),
  Object.freeze({ id: 'skills-forge-preview', route: '/skills', selector: '.skills-library', prepare: assertForgeSkillInstallPreview }),
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

async function assertSettingsScrollPreserved(page) {
  const result = await page.evaluate(async () => {
    const waitForFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
    const scroller = document.querySelector('[data-scroll-key="settings-content"]');
    if (!scroller) return { error: 'settings scroll container is missing' };
    const targetTop = Math.min(480, Math.max(0, scroller.scrollHeight - scroller.clientHeight));
    if (targetTop < 1) return { error: 'settings content is not scrollable' };
    scroller.scrollTop = targetTop;
    const before = scroller.scrollTop;
    const choice = document.querySelector('[data-setting-choice][data-setting-path="appearance.accent"][data-setting-value="blue"]');
    if (!choice) return { error: 'settings accent choice is missing' };
    choice.click();
    await waitForFrame();
    await waitForFrame();
    const next = document.querySelector('[data-scroll-key="settings-content"]');
    const selected = document.querySelector('[data-setting-choice][data-setting-path="appearance.accent"][data-setting-value="blue"][aria-pressed="true"]');
    return { before, after: next?.scrollTop ?? null, accentApplied: document.documentElement.dataset.accent === 'blue', selected: Boolean(selected) };
  });
  if (result.error) throw new Error(result.error);
  if (!result.accentApplied || !result.selected) throw new Error('settings accent choice did not update the live preference state');
  if (result.after == null || Math.abs(result.after - result.before) > 2) throw new Error(`settings content did not preserve scroll position: ${result.before} -> ${result.after}`);
}

async function assertResponsiveLayout(page, state) {
  const result = await page.evaluate(() => Object.freeze({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body?.scrollWidth ?? 0,
  }));
  const renderedWidth = Math.max(result.documentWidth, result.bodyWidth);
  if (renderedWidth > result.viewportWidth + 1) {
    throw new Error(`${state.id} responsive layout overflows horizontally: ${renderedWidth}px > ${result.viewportWidth}px`);
  }
}

async function assertProjectPickerKeyboard(page) {
  const picker = page.locator('[data-project-picker="home-project-picker"]');
  const trigger = picker.locator('[data-project-picker-toggle]');
  const menu = picker.locator('[data-project-picker-menu]');
  const search = picker.locator('[data-project-search]');
  await trigger.focus();
  await page.keyboard.press('ArrowDown');
  await menu.waitFor({ state: 'visible', timeout: 5_000 });
  const searchFocused = await search.evaluate((node) => document.activeElement === node);
  if (!searchFocused) throw new Error('project picker did not move focus to search after ArrowDown');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(50);
  if (!await menu.isHidden()) throw new Error('project picker did not close after Escape');
  const triggerFocused = await trigger.evaluate((node) => document.activeElement === node);
  if (!triggerFocused) throw new Error('project picker did not return focus to its trigger after Escape');
}

async function assertForgeSkillInstallPreview(page) {
  await page.locator('[data-skills-catalog]').selectOption('v2');
  const forgeSkill = page.locator('[data-skill-library-select^="forgeos:"]').first();
  await forgeSkill.waitFor({ state: 'visible', timeout: 10_000 });
  await forgeSkill.click();
  const install = page.locator('[data-action="install-skill"]');
  await install.waitFor({ state: 'visible', timeout: 10_000 });
  if (await install.isDisabled()) throw new Error('skills Forge OS preview did not expose an installation action');
}

async function assertAccessibility(page, state) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const blocking = result.violations.filter((violation) => ['serious', 'critical'].includes(String(violation.impact)));
  if (blocking.length) {
    const summary = blocking.flatMap((violation) => violation.nodes.slice(0, 10).map((node) => `${violation.id} (${violation.impact}) at ${node.target.join(' ')}`)).join(', ');
    throw new Error(`${state.id} reported serious or critical accessibility violations: ${summary}`);
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
      const viewport = state.viewport ?? DEFAULT_VIEWPORT;
      const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(String(error?.message ?? error)));
      await page.goto(stateUrl(root, credential, state.route), { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.locator(state.selector).waitFor({ state: 'visible', timeout: 30_000 });
      await page.waitForTimeout(400);
      if (state.prepare) await state.prepare(page);
      if (state.id === 'settings') await assertSettingsScrollPreserved(page);
      if (state.id === 'home') await assertProjectPickerKeyboard(page);
      await assertResponsiveLayout(page, state);
      if (state.id !== 'home-nocturne') await assertAccessibility(page, state);
      if (pageErrors.length) throw new Error(`${state.id} emitted page errors: ${pageErrors.join(' | ')}`);
      const filename = `${state.id}.png`;
      const file = path.join(output, filename);
      await page.screenshot({ path: file, fullPage: true, animations: 'disabled' });
      const body = await readFile(file);
      captures.push(Object.freeze({ id: state.id, route: state.route, viewport: Object.freeze({ ...viewport, deviceScaleFactor: 1 }), file: filename, bytes: body.length, sha256: sha256(body) }));
      await context.close();
    }
  } finally {
    await browser.close();
  }
  const byId = new Map([...prior, ...captures].map((capture) => [capture.id, capture]));
  const report = Object.freeze({
    schema: 'nolane.ui.runtime-visual-receipt.v1',
    viewport: Object.freeze({ ...DEFAULT_VIEWPORT, deviceScaleFactor: 1 }),
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
