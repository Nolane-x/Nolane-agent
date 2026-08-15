#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const TARGET = 'scripts/capture-ui-runtime-visual.mjs';
const EXPECTED_BLOB = '30c2c086d45af93c1bd4ec4600d14b0c92ba5864';

function fail(message) { throw new Error(message); }
function blob(path) { return execFileSync('git', ['hash-object', path], { encoding: 'utf8' }).trim(); }
function replaceOnce(source, from, to, label) {
  const first = source.indexOf(from);
  if (first < 0) fail(`missing Task 10 anchor: ${label}`);
  if (source.indexOf(from, first + from.length) >= 0) fail(`non-unique Task 10 anchor: ${label}`);
  return `${source.slice(0, first)}${to}${source.slice(first + from.length)}`;
}
function replaceSection(source, start, end, replacement, label) {
  const first = source.indexOf(start);
  if (first < 0) fail(`missing Task 10 section start: ${label}`);
  const last = source.indexOf(end, first + start.length);
  if (last < 0) fail(`missing Task 10 section end: ${label}`);
  if (source.indexOf(start, first + start.length) >= 0) fail(`non-unique Task 10 section start: ${label}`);
  return `${source.slice(0, first)}${replacement}${source.slice(last)}`;
}

if (blob(TARGET) !== EXPECTED_BLOB) fail(`refusing Task 10 migration: ${TARGET} blob drifted`);
let source = readFileSync(TARGET, 'utf8');

const states = `const STATES = Object.freeze([
  Object.freeze({ id: 'onboarding', route: '/onboarding', selector: '.onboarding-shell', afterCapture: assertOnboardingRecommendedNavigation }),
  Object.freeze({ id: 'home', route: '/', selector: '.home-view' }),
  Object.freeze({ id: 'home-experience-menu', route: '/', selector: '.home-view', prepare: assertExperienceMenuOpaque }),
  Object.freeze({ id: 'home-compact', route: '/', selector: '.home-view', viewport: Object.freeze({ width: 640, height: 900 }) }),
  Object.freeze({ id: 'home-keyboard-focus', route: '/', selector: '.home-view', prepare: assertHomeKeyboardFocus }),
  Object.freeze({ id: 'home-reduced-motion', route: '/', selector: '.home-view', contextOptions: Object.freeze({ reducedMotion: 'reduce' }), prepare: assertReducedMotion }),
  Object.freeze({ id: 'home-forced-colors', route: '/', selector: '.home-view', contextOptions: Object.freeze({ forcedColors: 'active' }), prepare: assertForcedColorsFocus }),
  Object.freeze({ id: 'home-nocturne', route: '/', selector: '.home-view', theme: 'nocturne' }),
  Object.freeze({ id: 'projects', route: '/projects', selector: '.projects-page' }),
  Object.freeze({ id: 'projects-nocturne', route: '/projects', selector: '.projects-page', theme: 'nocturne' }),
  Object.freeze({ id: 'skills', route: '/skills', selector: '.skills-library' }),
  Object.freeze({ id: 'skills-catalog-picker', route: '/skills', selector: '.skills-library', prepare: assertSkillsCatalogPicker }),
  Object.freeze({ id: 'skills-forge-preview', route: '/skills', selector: '.skills-library', prepare: assertForgeSkillInstallPreview }),
  Object.freeze({ id: 'skills-nocturne', route: '/skills', selector: '.skills-library', theme: 'nocturne' }),
  Object.freeze({ id: 'settings', route: '/settings', selector: '#workspace' }),
  Object.freeze({ id: 'settings-option-picker', route: '/settings', selector: '.settings-center', prepare: assertSettingsOptionPicker }),
  Object.freeze({ id: 'settings-language-roundtrip', route: '/settings', selector: '.settings-center', prepare: assertSettingsLanguageRoundtrip }),
  Object.freeze({ id: 'settings-model-catalog', route: '/settings', selector: '.settings-center', prepare: assertSettingsModelCatalog }),
  Object.freeze({ id: 'settings-model-catalog-vi', route: '/settings', selector: '.settings-center', locale: 'vi', prepare: assertSettingsModelCatalog }),
  Object.freeze({ id: 'settings-vi-compact', route: '/settings', selector: '.settings-center', locale: 'vi', viewport: Object.freeze({ width: 640, height: 900 }), prepare: assertVietnameseResponsive }),
  Object.freeze({ id: 'settings-nocturne', route: '/settings', selector: '.settings-center', theme: 'nocturne' }),
  Object.freeze({ id: 'workroom', route: '/workroom', selector: '.workroom-view' }),
  Object.freeze({ id: 'workroom-nocturne', route: '/workroom', selector: '.workroom-view', theme: 'nocturne' }),
  Object.freeze({ id: 'control-plane', route: '/control-plane', selector: '#workspace' }),
  Object.freeze({ id: 'control-plane-nocturne', route: '/control-plane', selector: '#workspace', theme: 'nocturne' }),
  Object.freeze({ id: 'mission-proofline', route: '/missions', selector: '.activity-page', viewport: Object.freeze({ width: 1440, height: 1000 }), prepare: prepareProoflineMission }),
  Object.freeze({ id: 'mission-proofline-compact', route: '/missions', selector: '.activity-page', viewport: Object.freeze({ width: 820, height: 1000 }), prepare: prepareProoflineMission }),
  Object.freeze({ id: 'mission-proofline-focus', route: '/missions', selector: '.activity-page', prepare: prepareProoflineFocus }),
  Object.freeze({ id: 'mission-proofline-nocturne', route: '/missions', selector: '.activity-page', theme: 'nocturne', prepare: prepareProoflineMission }),
  Object.freeze({ id: 'review-runtime', route: '/missions', selector: '.review-detail', bootstrap: prepareReviewRoute, prepare: assertReviewRuntimeTruth }),
  Object.freeze({ id: 'review-runtime-compact', route: '/missions', selector: '.review-detail', viewport: Object.freeze({ width: 820, height: 1000 }), bootstrap: prepareReviewRoute, prepare: assertReviewRuntimeTruth }),
  Object.freeze({ id: 'browser', route: '/browser', selector: '.browser-workspace', prepare: assertBrowserWorkspaceBoundary }),
  Object.freeze({ id: 'browser-blocked', route: '/browser', selector: '.browser-workspace', viewport: Object.freeze({ width: 640, height: 900 }), prepare: assertBrowserWorkspaceBoundary }),
  Object.freeze({ id: 'browser-nocturne', route: '/browser', selector: '.browser-workspace', theme: 'nocturne', prepare: assertBrowserWorkspaceBoundary }),
]);`;
source = replaceSection(source, 'const STATES = Object.freeze([', '\n\nconst sha256', states, 'state inventory');
source = replaceOnce(source, 'let prooflineFixture = null;', 'let prooflineFixture = null;\nlet reviewFixture = null;', 'runtime fixtures');

const preferencesAndMetadata = `
async function applyStatePreferences(page, state) {
  if (state.id === 'onboarding') return;
  const patch = Object.freeze({
    appearance: Object.freeze({ theme: state.theme ?? 'light' }),
    general: Object.freeze({ language: state.locale ?? 'en' }),
  });
  const outcome = await page.evaluate(async (value) => {
    const response = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ layer: 'user', patch: value }),
    });
    return { ok: response.ok, status: response.status };
  }, patch);
  if (!outcome.ok) throw new Error(\`unable to apply runtime preferences for \${state.id}: HTTP \${outcome.status}\`);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 });
}

async function captureRuntimeMetadata(page, state, { axe } = {}) {
  const raw = await page.evaluate(async () => {
    let effective = null;
    try {
      const response = await fetch('/api/settings/effective');
      if (response.ok) effective = await response.json();
    } catch {}
    const active = document.activeElement;
    const activeElement = active && active !== document.body ? {
      tag: active.tagName?.toLowerCase() ?? null,
      id: active.id || null,
      preserveKey: active.dataset?.preserveKey ?? null,
      command: active.dataset?.command ?? null,
      ariaLabel: active.getAttribute?.('aria-label') ?? null,
    } : null;
    const scroller = document.querySelector('[data-scroll-key]');
    const semantic = [...document.querySelectorAll('h1,h2,[data-command]')].slice(0, 64).map((node) => ({
      tag: node.tagName.toLowerCase(),
      command: node.dataset?.command ?? null,
      text: String(node.textContent ?? '').replace(/\\s+/g, ' ').trim().slice(0, 180),
    }));
    const documentWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0);
    return {
      experience: document.documentElement.dataset.experience ?? document.body?.dataset?.experience ?? effective?.value?.general?.experienceLevel ?? null,
      theme: effective?.value?.appearance?.theme ?? null,
      locale: document.documentElement.dataset.language ?? effective?.value?.general?.language ?? document.documentElement.lang ?? null,
      activeElement,
      scroll: { windowX: window.scrollX, windowY: window.scrollY, keyed: scroller ? { key: scroller.dataset.scrollKey ?? null, top: scroller.scrollTop, left: scroller.scrollLeft } : null },
      viewportWidth: window.innerWidth,
      documentWidth,
      semantic,
      media: { reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches, forcedColors: matchMedia('(forced-colors: active)').matches },
    };
  });
  return Object.freeze({
    experience: raw.experience ?? 'unknown',
    theme: raw.theme ?? state.theme ?? 'light',
    locale: String(raw.locale ?? state.locale ?? 'en').toLowerCase().startsWith('vi') ? 'vi' : 'en',
    activeElement: raw.activeElement,
    scroll: Object.freeze(raw.scroll),
    overflow: Object.freeze({ horizontal: raw.documentWidth <= raw.viewportWidth + 1 ? 'PASS' : 'FAIL', viewportWidth: raw.viewportWidth, documentWidth: raw.documentWidth }),
    axe: Object.freeze(axe ?? { seriousCritical: 'UNKNOWN', violationCount: null }),
    semanticSignature: sha256(JSON.stringify(raw.semantic)),
    media: Object.freeze(raw.media),
  });
}
`;
source = replaceOnce(source, '\n\nasync function previousCaptures(output) {', `${preferencesAndMetadata}\nasync function previousCaptures(output) {`, 'preference and metadata authority');

source = replaceOnce(source,
  "  if (clippedCatalogCopy.length) throw new Error(`provider catalog clips text at desktop width: ${clippedCatalogCopy.join(', ')}`);\n}",
  "  if (clippedCatalogCopy.length) throw new Error(`provider catalog clips text at desktop width: ${clippedCatalogCopy.join(', ')}`);\n  return Object.freeze({ providerCatalogClipping: 'PASS', canonicalProviderNames: 'PASS', requiredProviders: Object.freeze(requiredProviders) });\n}",
  'settings catalog runtime assertions');

const focusFunctions = `async function assertHomeKeyboardFocus(page) {
  const control = page.locator('[data-command="new-mission"]').first();
  await control.waitFor({ state: 'visible', timeout: 10_000 });
  await control.focus();
  const result = await control.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const computed = getComputedStyle(node);
    return {
      focused: document.activeElement === node,
      visibleIndicator: computed.outlineStyle !== 'none' || computed.boxShadow !== 'none' || computed.borderColor !== 'transparent',
      insideViewport: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
    };
  });
  if (!result.focused || !result.visibleIndicator || !result.insideViewport) throw new Error(`Home primary action focus evidence failed: ${JSON.stringify(result)}`);
  return Object.freeze({ focusVisible: 'PASS' });
}

async function assertReducedMotion(page) {
  const enabled = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (!enabled) throw new Error('reduced-motion runtime context was not active');
  return Object.freeze({ reducedMotion: 'PASS' });
}

async function assertForcedColorsFocus(page) {
  const enabled = await page.evaluate(() => matchMedia('(forced-colors: active)').matches);
  if (!enabled) throw new Error('forced-colors runtime context was not active');
  const result = await assertHomeKeyboardFocus(page);
  return Object.freeze({ forcedColors: 'PASS', focusVisible: result.focusVisible });
}

async function assertVietnameseResponsive(page) {
  const result = await page.evaluate(() => ({
    language: document.documentElement.dataset.language ?? document.documentElement.lang ?? '',
    shellLabel: document.querySelector('[data-command="new-mission"] span')?.textContent?.trim() ?? '',
  }));
  if (!String(result.language).toLowerCase().startsWith('vi') || result.shellLabel !== 'Cuộc trò chuyện mới') {
    throw new Error(`Vietnamese responsive state did not project Vietnamese UI truth: ${JSON.stringify(result)}`);
  }
  return Object.freeze({ vietnameseResponsive: 'PASS' });
}

`;
source = replaceOnce(source, '\nasync function assertExperienceMenuOpaque(page) {', `\n${focusFunctions}async function assertExperienceMenuOpaque(page) {`, 'focus/motion/locale assertions');

const prooflineAndReview = `async function prepareProoflineFocus(page) {
  const prepared = await prepareProoflineMission(page);
  const control = page.locator('[data-preserve-key="activity-follow"]').first();
  await control.waitFor({ state: 'visible', timeout: 10_000 });
  await control.focus();
  const key = await control.getAttribute('data-preserve-key');
  await page.waitForTimeout(5_200);
  const focusedKey = await page.evaluate(() => document.activeElement?.dataset?.preserveKey ?? null);
  if (!key || focusedKey !== key) throw new Error(`Activity polling lost keyboard focus: ${key} -> ${focusedKey}`);
  return Object.freeze({ ...prepared, pollingFocus: 'PASS' });
}

async function prepareReviewRoute(page) {
  if (!reviewFixture) {
    reviewFixture = await page.evaluate(async ({ workspaceRoot }) => {
      const request = async (pathname, { method = 'GET', body = null } = {}) => {
        const response = await fetch(pathname, {
          method,
          headers: body == null ? undefined : { 'content-type': 'application/json' },
          body: body == null ? undefined : JSON.stringify(body),
        });
        const text = await response.text();
        let payload = null;
        try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
        if (!response.ok) throw new Error(`${method} ${pathname} failed with ${response.status}: ${typeof payload === 'string' ? payload : JSON.stringify(payload)}`);
        return payload;
      };
      const project = await request('/api/projects', { method: 'POST', body: { name: 'Canonical Review Runtime Fixture', workspaceRoot, metadata: { evidenceFixture: 'task10-review-runtime-v1' } } });
      const mission = await request('/api/missions/plan', { method: 'POST', body: { projectId: project.id, objective: 'Review exact evidence truth without accepting stale state', plan: { summary: 'Create a bounded canonical Review fixture.', tasks: [{ id: 'review', title: 'Review exact diff truth', objective: 'Keep decisions bound to the current review snapshot.', role: 'reviewer', dependencies: [], allowedPaths: ['**'], deniedPaths: ['.env', '.env.*'] }] } } });
      const review = await request(`/api/agent/runs/${encodeURIComponent(mission.id)}/diff-review`);
      return Object.freeze({ projectId: project.id, missionId: mission.id, reviewSha256: review.reviewSha256 });
    }, { workspaceRoot: process.cwd() });
  }
  await page.evaluate(({ missionId }) => { location.hash = `/review/${encodeURIComponent(missionId)}`; }, reviewFixture);
  return Object.freeze({ fixture: Object.freeze({ ...reviewFixture }) });
}

async function assertReviewRuntimeTruth(page) {
  if (!reviewFixture?.reviewSha256) throw new Error('Review runtime fixture is unavailable');
  const machineId = await page.locator('.review-detail .ui-machine-id').textContent();
  const prefix = String(machineId ?? '').trim();
  if (!prefix || !String(reviewFixture.reviewSha256).startsWith(prefix)) throw new Error(`Review UI did not expose the current review SHA prefix: ${prefix}`);
  return Object.freeze({ reviewSha256Match: 'PASS' });
}

`;
source = replaceOnce(source, 'async function assertProoflineRecoveryKeyboard(page) {', `${prooflineAndReview}async function assertProoflineRecoveryKeyboard(page) {`, 'Proofline focus and Review runtime bootstrap');

const captureTail = `async function assertAccessibility(page, state) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const blocking = result.violations.filter((violation) => ['serious', 'critical'].includes(String(violation.impact)));
  if (blocking.length) {
    const summary = blocking.flatMap((violation) => violation.nodes.slice(0, 10).map((node) => `${violation.id} (${violation.impact}) at ${node.target.join(' ')}`)).join(', ');
    throw new Error(`${state.id} reported serious or critical accessibility violations: ${summary}`);
  }
  return Object.freeze({ seriousCritical: 'PASS', violationCount: result.violations.length });
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
      const context = await browser.newContext({ viewport, deviceScaleFactor: 1, ...(state.contextOptions ?? {}) });
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(String(error?.message ?? error)));
      await page.goto(stateUrl(root, credential, state.route), { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await applyStatePreferences(page, state);
      const bootstrap = state.bootstrap ? await state.bootstrap(page) : null;
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
      const axe = await assertAccessibility(page, state);
      if (pageErrors.length) throw new Error(`${state.id} emitted page errors: ${pageErrors.join(' | ')}`);
      const runtimeMetadata = await captureRuntimeMetadata(page, state, { axe });
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
        runtimeMetadata,
        runtimeAssertions: Object.freeze({
          axeSeriousCritical: 'PASS',
          horizontalOverflow: 'PASS',
          ...(bootstrap && typeof bootstrap === 'object' ? bootstrap : {}),
          ...(preparation && typeof preparation === 'object' ? preparation : {}),
          ...(state.id.startsWith('mission-proofline') ? {
            semanticHooks: preparation?.semanticHooks ?? [],
            checkpointEvidence: preparation?.fixture?.checkpointEvidence ?? 'UNKNOWN',
            keyboardFocus: prooflineKeyboard?.keyboardFocus ?? 'UNKNOWN',
            screenReader: 'UNKNOWN',
          } : {}),
        }),
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
    sourceRevision: process.env.NOLANE_UI_EVIDENCE_REVISION || process.env.GITHUB_SHA || null,
    viewport: Object.freeze({ ...DEFAULT_VIEWPORT, deviceScaleFactor: 1 }),
    captures: Object.freeze(STATES.flatMap((state) => byId.has(state.id) ? [byId.get(state.id)] : [])),
  });
  const receiptSha256 = sha256(JSON.stringify(report));
  await writeFile(path.join(output, 'receipt.json'), `${JSON.stringify({ ...report, receiptSha256 }, null, 2)}\n`);
  return Object.freeze({ output, captures, receiptSha256 });
}
`;
source = replaceSection(source, 'async function assertAccessibility(page, state) {', '\nconst isMain =', captureTail, 'capture/runtime metadata tail');

writeFileSync(TARGET, source);
console.log(JSON.stringify({ target: TARGET, before: EXPECTED_BLOB, after: blob(TARGET) }));
