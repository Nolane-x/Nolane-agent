#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';

const DEFAULT_VIEWPORT = Object.freeze({ width: 1440, height: 1000 });

const STATES = Object.freeze([
  Object.freeze({ id: 'onboarding', route: '/onboarding', selector: '.onboarding-shell', afterCapture: assertOnboardingRecommendedNavigation }),
  Object.freeze({ id: 'home', route: '/', selector: '.home-view' }),
  Object.freeze({ id: 'home-experience-menu', route: '/', selector: '.home-view', prepare: assertExperienceMenuOpaque }),
  Object.freeze({ id: 'home-compact', route: '/', selector: '.home-view', viewport: Object.freeze({ width: 640, height: 900 }) }),
  Object.freeze({ id: 'home-nocturne', route: '/', selector: '.home-view' }),
  Object.freeze({ id: 'projects', route: '/projects', selector: '.projects-page' }),
  Object.freeze({ id: 'skills', route: '/skills', selector: '.skills-library' }),
  Object.freeze({ id: 'skills-catalog-picker', route: '/skills', selector: '.skills-library', prepare: assertSkillsCatalogPicker }),
  Object.freeze({ id: 'skills-forge-preview', route: '/skills', selector: '.skills-library', prepare: assertForgeSkillInstallPreview }),
  Object.freeze({ id: 'settings', route: '/settings', selector: '#workspace' }),
  Object.freeze({ id: 'settings-option-picker', route: '/settings', selector: '.settings-center', prepare: assertSettingsOptionPicker }),
  Object.freeze({ id: 'settings-language-roundtrip', route: '/settings', selector: '.settings-center', prepare: assertSettingsLanguageRoundtrip }),
  Object.freeze({ id: 'settings-model-catalog', route: '/settings', selector: '.settings-center', prepare: assertSettingsModelCatalog }),
  Object.freeze({ id: 'workroom', route: '/workroom', selector: '.workroom-view' }),
  Object.freeze({ id: 'control-plane', route: '/control-plane', selector: '#workspace' }),
  Object.freeze({ id: 'mission-proofline', route: '/missions', selector: '.activity-page', viewport: Object.freeze({ width: 1440, height: 1000 }), prepare: prepareProoflineMission }),
  Object.freeze({ id: 'mission-proofline-compact', route: '/missions', selector: '.activity-page', viewport: Object.freeze({ width: 820, height: 1000 }), prepare: prepareProoflineMission }),
  Object.freeze({ id: 'browser', route: '/browser', selector: '.browser-workspace', prepare: assertBrowserWorkspaceBoundary }),
]);

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
let prooflineFixture = null;

function required(value, name) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new TypeError(`${name} is required`);
  return normalized;
}

function stateUrl(baseUrl, token, route) {
  const target = new URL(baseUrl);
  const routeUrl = new URL(route, target);
  routeUrl.searchParams.set('token', token);
  target.hash = `${routeUrl.pathname}${routeUrl.search}`;
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

function redactDiagnosticText(value) {
  return String(value ?? '').replace(/([?&](?:token|authorization)=[^&\s]+)/gi, '$1[redacted]');
}

function safeDiagnosticUrl(value) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}${url.hash}`;
  } catch {
    return 'unavailable';
  }
}

async function readOnboardingStatus(root, credential) {
  try {
    const endpoint = new URL('/api/onboarding/status', root);
    const response = await fetch(endpoint, { headers: { authorization: `Bearer ${credential}` } });
    if (!response.ok) return Object.freeze({ reachable: false, status: response.status });
    const payload = await response.json();
    return Object.freeze({
      reachable: true,
      status: response.status,
      required: Boolean(payload?.required),
      disabled: Boolean(payload?.disabled),
      inferredExistingUser: Boolean(payload?.inferredExistingUser),
      completionSource: typeof payload?.state?.source === 'string' ? payload.state.source : null,
    });
  } catch (error) {
    return Object.freeze({ reachable: false, error: redactDiagnosticText(error?.message ?? error) });
  }
}

async function captureRenderDiagnostic({ page, state, root, credential, pageErrors }) {
  try {
    const rendered = await page.evaluate((selector) => Object.freeze({
      title: document.title,
      hash: location.hash,
      selectorPresent: Boolean(document.querySelector(selector)),
      roots: [...document.body.children].slice(0, 8).map((node) => Object.freeze({
        tag: node.tagName.toLowerCase(),
        id: node.id || null,
        className: typeof node.className === 'string' ? node.className.slice(0, 160) : null,
        hidden: Boolean(node.hidden),
      })),
    }), state.selector);
    const onboardingStatus = state.id === 'onboarding' ? await readOnboardingStatus(root, credential) : null;
    return Object.freeze({
      url: safeDiagnosticUrl(page.url()),
      rendered,
      onboardingStatus,
      pageErrors: pageErrors.map(redactDiagnosticText),
    });
  } catch (error) {
    return Object.freeze({ diagnosticFailure: redactDiagnosticText(error?.message ?? error), pageErrors: pageErrors.map(redactDiagnosticText) });
  }
}

async function chooseSettingsCategory(page, category) {
  const link = page.locator(`[data-settings-category-link="${category}"]`);
  await link.waitFor({ state: 'visible', timeout: 10_000 });
  await link.click();
  const section = page.locator(`[data-settings-category="${category}"]`);
  await section.waitFor({ state: 'visible', timeout: 10_000 });
  return section;
}

async function assertSettingsScrollPreserved(page) {
  const setScrollPosition = () => page.evaluate(() => {
    const scroller = document.querySelector('[data-scroll-key="settings-content"]');
    if (!scroller) return { error: 'settings scroll container is missing' };
    const targetTop = Math.min(480, Math.max(0, scroller.scrollHeight - scroller.clientHeight));
    scroller.scrollTop = targetTop;
    return { before: scroller.scrollTop, scrollable: targetTop > 0 };
  });
  const setScrollForVisibleControl = (control) => control.evaluate((node) => {
    const scroller = document.querySelector('[data-scroll-key="settings-content"]');
    if (!scroller) return { error: 'settings scroll container is missing' };
    const scrollerBox = scroller.getBoundingClientRect();
    const controlBox = node.getBoundingClientRect();
    const contentTop = scroller.scrollTop + controlBox.top - scrollerBox.top;
    const top = Math.min(480, Math.max(0, scroller.scrollHeight - scroller.clientHeight), Math.max(0, contentTop - 24));
    scroller.scrollTop = top;
    return { before: scroller.scrollTop, scrollable: top > 0 };
  });
  const assertScroll = async (before, label) => {
    const after = await page.locator('[data-scroll-key="settings-content"]').evaluate((node) => node.scrollTop);
    if (after == null || Math.abs(after - before) > 2) throw new Error(`${label} did not preserve scroll position: ${before} -> ${after}`);
  };

  await chooseSettingsCategory(page, 'appearance');
  const accent = await setScrollPosition();
  if (accent.error) throw new Error(accent.error);
  const accentChoice = page.locator('[data-setting-choice][data-setting-path="appearance.accent"][data-setting-value="blue"]');
  await accentChoice.click();
  await accentChoice.waitFor({ state: 'visible', timeout: 10_000 });
  if (await accentChoice.getAttribute('aria-pressed') !== 'true') throw new Error('settings accent choice did not update the live preference state');
  await assertScroll(accent.before, 'settings content');

  await chooseSettingsCategory(page, 'general');
  const language = await page.evaluate(() => document.querySelector('[data-setting-choice][data-setting-path="general.language"][aria-pressed="true"]')?.dataset?.settingValue === 'vi' ? 'en' : 'vi');
  const languageChoice = page.locator(`[data-setting-choice][data-setting-path="general.language"][data-setting-value="${language}"]`);
  const beforeLanguage = await setScrollForVisibleControl(languageChoice);
  if (beforeLanguage.error) throw new Error(beforeLanguage.error);
  await languageChoice.click();
  await page.waitForFunction(({ nextLanguage, expectedTop }) => document.documentElement.dataset.language === nextLanguage && document.querySelector(`[data-setting-choice][data-setting-path="general.language"][data-setting-value="${nextLanguage}"][aria-pressed="true"]`) && Math.abs((document.querySelector('[data-scroll-key="settings-content"]')?.scrollTop ?? 0) - expectedTop) <= 2, { nextLanguage: language, expectedTop: beforeLanguage.before }, { timeout: 10_000 });
  await assertScroll(beforeLanguage.before, 'settings language choice');
}

async function assertSettingsLanguageRoundtrip(page) {
  const vietnameseChoice = page.locator('[data-setting-choice][data-setting-path="general.language"][data-setting-value="vi"]');
  await vietnameseChoice.click();
  await page.waitForFunction(() => document.documentElement.dataset.language === 'vi'
    && document.querySelector('[data-setting-choice][data-setting-path="general.language"][data-setting-value="vi"]')?.getAttribute('aria-pressed') === 'true', { timeout: 10_000 });
  const previewLabel = await page.locator('[data-command="new-mission"] span').textContent();
  if (String(previewLabel ?? '').trim() !== 'Cuộc trò chuyện mới') throw new Error('language choice did not update the rendered interface to Vietnamese');

  const save = page.locator('[data-settings-action="save"]');
  await save.click();
  try {
    await page.waitForFunction(async () => {
      const response = await fetch('/api/settings/effective');
      if (!response.ok) return false;
      const effective = await response.json();
      return effective?.value?.general?.language === 'vi';
    }, { timeout: 10_000 });
  } catch {
    throw new Error('language save did not persist Vietnamese before leaving settings');
  }

  await page.evaluate(() => { location.hash = '/'; });
  await page.locator('.home-view').waitFor({ state: 'visible', timeout: 10_000 });
  const shellLabel = await page.locator('[data-command="new-mission"] span').textContent();
  if (String(shellLabel ?? '').trim() !== 'Cuộc trò chuyện mới') throw new Error('chat shell still rendered English after saving Vietnamese');
}

async function assertSettingsOptionPicker(page) {
  await chooseSettingsCategory(page, 'general');
  const pickerId = 'setting-general.defaultIntent';
  const picker = page.locator(`[data-option-picker="${pickerId}"]`);
  const trigger = picker.locator('[data-option-picker-toggle]');
  await trigger.waitFor({ state: 'visible', timeout: 10_000 });
  const before = await trigger.evaluate((node) => {
    const scroller = document.querySelector('[data-scroll-key="settings-content"]');
    if (!scroller) return { error: 'settings scroll container is missing' };
    const scrollerBox = scroller.getBoundingClientRect();
    const box = node.getBoundingClientRect();
    const contentTop = scroller.scrollTop + box.top - scrollerBox.top;
    const top = Math.min(480, Math.max(0, scroller.scrollHeight - scroller.clientHeight), Math.max(0, contentTop - 24));
    scroller.scrollTop = top;
    return { top: scroller.scrollTop, scrollable: top > 0 };
  });
  if (before.error) throw new Error(before.error);
  await trigger.click();
  const next = picker.locator('[data-option-picker-option][aria-selected="false"]:not([disabled])').first();
  await next.waitFor({ state: 'visible', timeout: 10_000 });
  const value = await next.getAttribute('data-option-picker-option');
  await next.click();
  await page.waitForFunction(({ pickerId, value }) => document.querySelector(`[data-option-picker="${pickerId}"] [data-option-picker-value]`)?.value === value, { pickerId, value }, { timeout: 10_000 });
  const after = await page.locator('[data-scroll-key="settings-content"]').evaluate((node) => node.scrollTop);
  if (after == null || Math.abs(after - before.top) > 2) throw new Error(`settings option picker did not preserve scroll position: ${before.top} -> ${after}`);
}

async function assertSettingsModelCatalog(page) {
  await page.locator('[data-settings-category-link="models"]').click();
  const modelsSection = page.locator('#settings-models');
  await modelsSection.scrollIntoViewIfNeeded();
  const catalog = modelsSection.locator('.provider-catalog');
  await catalog.waitFor({ state: 'visible', timeout: 10_000 });
  const providers = await modelsSection.locator('.provider-model-group').evaluateAll((nodes) => nodes.map((node) => node.dataset.providerId));
  const requiredProviders = ['codex', 'claude', 'gemini', 'opencode'];
  const missing = requiredProviders.filter((id) => !providers.includes(id));
  if (missing.length) throw new Error(`provider catalog omitted required agent entries: ${missing.join(', ')}`);

  const claudeCatalog = await modelsSection.locator('#provider-claude').innerText();
  if (!/sonnet/i.test(claudeCatalog) || !/opus/i.test(claudeCatalog)) throw new Error('Claude compatibility models were not rendered');
  if (await modelsSection.locator('[data-model-provider-setup] input[data-model-api-key]').count() !== 1) throw new Error('API provider setup form did not render an API key field');
  const clippedCatalogCopy = await catalog.locator('.provider-catalog__name,.provider-catalog__meta strong').evaluateAll((nodes) => nodes
    .filter((node) => node.scrollWidth > node.clientWidth + 1)
    .map((node) => node.textContent?.trim())
    .filter(Boolean));
  if (clippedCatalogCopy.length) throw new Error(`provider catalog clips text at desktop width: ${clippedCatalogCopy.join(', ')}`);
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

async function assertExperienceMenuOpaque(page) {
  const trigger = page.locator('[data-command="toggle-experience"]');
  const menu = page.locator('[data-experience-menu]');
  await trigger.click();
  await menu.waitFor({ state: 'visible', timeout: 5_000 });
  const result = await menu.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const computed = getComputedStyle(node);
    const sampleX = Math.round(rect.left + Math.min(24, rect.width / 2));
    const sampleY = Math.round(rect.top + Math.min(24, rect.height / 2));
    const top = document.elementFromPoint(sampleX, sampleY);
    const color = computed.backgroundColor;
    const alpha = color.startsWith('rgba(') ? Number(color.slice(color.lastIndexOf(',') + 1, -1).trim()) : 1;
    return Object.freeze({ alpha, occupiesTopLayer: Boolean(top && node.contains(top)), visibility: computed.visibility, opacity: Number(computed.opacity) });
  });
  if (result.alpha < 1 || result.opacity < 1 || result.visibility !== 'visible') throw new Error('experience menu background is not opaque');
  if (!result.occupiesTopLayer) throw new Error('experience menu did not occupy the top stacking position');
}

async function assertBrowserWorkspaceBoundary(page) {
  const open = page.locator('[data-browser-action="open"]');
  const screenshot = page.locator('[data-browser-action="screenshot"]');
  if (!await open.isDisabled() || !await screenshot.isDisabled()) throw new Error('Browser workspace exposed navigation without a selected project');
  const leakedToken = await page.locator('body').innerText().then((text) => String(text).includes('nolane-ui-runtime-evidence-token'));
  if (leakedToken) throw new Error('Browser workspace exposed a local authentication token');
}

async function assertForgeSkillInstallPreview(page) {
  await chooseOptionPickerValue(page, 'skills-catalog', 'v2');
  const forgeSkill = page.locator('[data-skill-library-select^="forgeos:"]').first();
  await forgeSkill.waitFor({ state: 'visible', timeout: 10_000 });
  await forgeSkill.click();
  const install = page.locator('[data-action="install-skill"]');
  await install.waitFor({ state: 'visible', timeout: 10_000 });
  if (await install.isDisabled()) throw new Error('skills Forge OS preview did not expose an installation action');
}

async function chooseOptionPickerValue(page, pickerId, value) {
  const picker = page.locator(`[data-option-picker="${pickerId}"]`);
  const trigger = picker.locator('[data-option-picker-toggle]');
  const option = picker.locator(`[data-option-picker-option="${value}"]`);
  await trigger.click();
  await option.waitFor({ state: 'visible', timeout: 10_000 });
  await option.click();
}

async function assertSkillsCatalogPicker(page) {
  const picker = page.locator('[data-option-picker="skills-catalog"]');
  const trigger = picker.locator('[data-option-picker-toggle]');
  const menu = picker.locator('[data-option-picker-menu]');
  await trigger.focus();
  await page.keyboard.press('ArrowDown');
  await menu.waitFor({ state: 'visible', timeout: 10_000 });
  const details = await menu.evaluate((node) => {
    const computed = getComputedStyle(node);
    const color = computed.backgroundColor;
    const alpha = color.startsWith('rgba(') ? Number(color.slice(color.lastIndexOf(',') + 1, -1).trim()) : 1;
    return Object.freeze({
      role: node.getAttribute('role'),
      alpha,
      opacity: Number(computed.opacity),
      visibility: computed.visibility,
      selected: node.querySelector('[role="option"][aria-selected="true"]')?.getAttribute('data-option-picker-option'),
      options: node.querySelectorAll('[role="option"]').length,
    });
  });
  if (details.role !== 'listbox' || details.alpha < 1 || details.opacity < 1 || details.visibility !== 'visible' || details.options < 3 || details.selected === null) throw new Error(`skills catalog picker did not render an accessible opaque option menu: ${JSON.stringify(details)}`);
}

async function assertOnboardingRecommendedNavigation(page) {
  await page.locator('[data-onboarding-action="recommended"]').click();
  try {
    await page.locator('.home-view').waitFor({ state: 'visible', timeout: 10_000 });
  } catch {
    throw new Error('onboarding completion did not navigate to the home workspace');
  }
}

async function prepareProoflineMission(page) {
  if (!prooflineFixture) {
    prooflineFixture = await page.evaluate(async ({ workspaceRoot }) => {
      const request = async (pathname, { method = 'GET', body = null, tolerateFailure = false } = {}) => {
        const response = await fetch(pathname, {
          method,
          headers: body == null ? undefined : { 'content-type': 'application/json' },
          body: body == null ? undefined : JSON.stringify(body),
        });
        const text = await response.text();
        let payload = null;
        try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
        if (!response.ok && !tolerateFailure) throw new Error(`${method} ${pathname} failed with ${response.status}: ${typeof payload === 'string' ? payload : JSON.stringify(payload)}`);
        return { ok: response.ok, status: response.status, payload };
      };

      const projectResult = await request('/api/projects', {
        method: 'POST',
        body: { name: 'NUI Proofline Runtime Fixture', workspaceRoot, metadata: { evidenceFixture: 'mission-proofline-runtime-v1' } },
      });
      const project = projectResult.payload;
      const objective = 'Ship a trustworthy provider integration while preserving evidence lineage and safe recovery';
      const missionResult = await request('/api/missions/plan', {
        method: 'POST',
        body: {
          projectId: project.id,
          objective,
          plan: {
            summary: 'Contract the boundary, implement the bounded adapter, then require independent verification.',
            tasks: [
              { id: 'inspect', title: 'Inspect trust boundary', objective: 'Map provider authority, evidence lineage, and recovery constraints.', role: 'scout', dependencies: [], allowedPaths: ['src/**', 'tests/**'], deniedPaths: ['.env', '.env.*'] },
              { id: 'build', title: 'Implement bounded adapter', objective: 'Implement the integration without expanding provider or host authority.', role: 'builder', dependencies: ['inspect'], allowedPaths: ['src/**', 'tests/**'], deniedPaths: ['.env', '.env.*'] },
              { id: 'verify', title: 'Independently verify evidence', objective: 'Review runtime evidence and preserve unresolved external gates as unknown.', role: 'reviewer', dependencies: ['build'], allowedPaths: ['**'], deniedPaths: ['.env', '.env.*'] },
            ],
          },
        },
      });
      const mission = missionResult.payload;

      const trust = await request(`/api/workspace-trust/${encodeURIComponent(project.id)}`, {
        method: 'PUT',
        body: { reason: 'Ephemeral CI runtime visual evidence fixture' },
        tolerateFailure: true,
      });
      let checkpoint = null;
      if (trust.ok) {
        const checkpointResult = await request('/api/time-travel/checkpoints', {
          method: 'POST',
          body: { missionId: mission.id, label: 'Before Proofline runtime evidence' },
          tolerateFailure: true,
        });
        if (checkpointResult.ok) checkpoint = checkpointResult.payload;
      }
      return Object.freeze({ projectId: project.id, missionId: mission.id, objective, checkpointId: checkpoint?.id ?? null, checkpointEvidence: checkpoint ? 'AVAILABLE' : 'UNKNOWN' });
    }, { workspaceRoot: process.cwd() });
  }

  await page.evaluate(({ missionId }) => { location.hash = `/missions?id=${encodeURIComponent(missionId)}`; }, prooflineFixture);
  for (const selector of ['.mission-spotlight', '.execution-story', '.time-travel', '.activity-filament']) {
    await page.locator(selector).waitFor({ state: 'visible', timeout: 20_000 });
  }
  await page.waitForFunction(({ missionId, objective }) => {
    const mission = document.querySelector('.mission-spotlight');
    return location.hash.includes(encodeURIComponent(missionId)) && mission?.textContent?.includes(objective);
  }, { missionId: prooflineFixture.missionId, objective: prooflineFixture.objective }, { timeout: 20_000 });
  return Object.freeze({
    fixture: Object.freeze({ ...prooflineFixture }),
    semanticHooks: Object.freeze(['mission-spotlight', 'execution-story', 'time-travel', 'activity-filament']),
  });
}

async function assertProoflineRecoveryKeyboard(page) {
  const control = page.locator('.time-travel [data-time-travel-action="create"]').first();
  await control.waitFor({ state: 'visible', timeout: 10_000 });
  await control.focus();
  const focus = await control.evaluate((node) => {
    const computed = getComputedStyle(node);
    const visibleIndicator = computed.outlineStyle !== 'none' || computed.boxShadow !== 'none' || computed.borderColor !== 'transparent';
    return Object.freeze({ focused: document.activeElement === node, visibleIndicator });
  });
  if (!focus.focused || !focus.visibleIndicator) throw new Error('Proofline recovery control did not expose visible keyboard focus');
  return Object.freeze({ keyboardFocus: 'PASS', screenReader: 'UNKNOWN' });
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
      try {
        await page.locator(state.selector).waitFor({ state: 'visible', timeout: 30_000 });
      } catch (error) {
        const diagnostic = await captureRenderDiagnostic({ page, state, root, credential, pageErrors });
        throw new Error(`UI state did not render: ${state.id}; diagnostic=${JSON.stringify(diagnostic)}`, { cause: error });
      }
      await page.waitForTimeout(400);
      const preparation = state.prepare ? await state.prepare(page) : null;
      if (state.id === 'settings') await assertSettingsScrollPreserved(page);
      if (state.id === 'home') await assertProjectPickerKeyboard(page);
      const prooflineKeyboard = state.id.startsWith('mission-proofline') ? await assertProoflineRecoveryKeyboard(page) : null;
      await assertResponsiveLayout(page, state);
      if (state.id !== 'home-nocturne') await assertAccessibility(page, state);
      if (pageErrors.length) throw new Error(`${state.id} emitted page errors: ${pageErrors.join(' | ')}`);
      const filename = `${state.id}.png`;
      const file = path.join(output, filename);
      await page.screenshot({ path: file, fullPage: true, animations: 'disabled' });
      const body = await readFile(file);
      captures.push(Object.freeze({
        id: state.id,
        route: state.route,
        viewport: Object.freeze({ ...viewport, deviceScaleFactor: 1 }),
        file: filename,
        bytes: body.length,
        sha256: sha256(body),
        ...(state.id.startsWith('mission-proofline') ? {
          runtimeAssertions: Object.freeze({
            semanticHooks: preparation?.semanticHooks ?? [],
            checkpointEvidence: preparation?.fixture?.checkpointEvidence ?? 'UNKNOWN',
            keyboardFocus: prooflineKeyboard?.keyboardFocus ?? 'UNKNOWN',
            axeSeriousCritical: 'PASS',
            horizontalOverflow: 'PASS',
            screenReader: 'UNKNOWN',
          }),
        } : {}),
      }));
      if (state.afterCapture) await state.afterCapture(page);
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
