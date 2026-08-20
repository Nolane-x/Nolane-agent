#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

export const PERFORMANCE_BUDGETS = Object.freeze({
  homeInteractiveMs: 250,
  routeSwitchP95Ms: 100,
  longTaskMaxMs: 50,
  idleCpuPercent: 1,
  homeDomNodes: 1200,
  homeRendererMemoryBytes: 180 * 1024 * 1024,
  interactiveInputP95Ms: 50,
});

const ROUTES = Object.freeze([
  Object.freeze({ id: 'home', route: '/', selector: '.home-view' }),
  Object.freeze({ id: 'projects', route: '/projects', selector: '.projects-page' }),
  Object.freeze({ id: 'skills', route: '/skills', selector: '.skills-library' }),
  Object.freeze({ id: 'settings', route: '/settings', selector: '.settings-center' }),
  Object.freeze({ id: 'workroom', route: '/workroom', selector: '.workroom-view' }),
  Object.freeze({ id: 'control-plane', route: '/control-plane', selector: '#workspace' }),
  Object.freeze({ id: 'missions', route: '/missions', selector: '.activity-page' }),
  Object.freeze({ id: 'browser', route: '/browser', selector: '.browser-workspace' }),
]);

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const required = (value, name) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new TypeError(`${name} is required`);
  return normalized;
};
const redact = (value) => String(value ?? '')
  .replace(/([?&](?:token|authorization)=)[^&\s#]+/gi, '$1[redacted]')
  .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, '$1[redacted]');

function machineSnapshot() {
  return Object.freeze({
    os: process.platform,
    arch: process.arch,
    ramGb: Number((os.totalmem() / 1024 ** 3).toFixed(2)),
    logicalCpuCount: os.cpus().length,
    cpuModel: os.cpus()[0]?.model ?? 'unknown',
  });
}

function stateUrl(baseUrl, token, route) {
  const root = new URL(baseUrl);
  const routeUrl = new URL(route, root);
  routeUrl.searchParams.set('token', token);
  root.hash = `${routeUrl.pathname}${routeUrl.search}`;
  return root.toString();
}

async function apiJson(baseUrl, token, pathname, { method = 'GET', body = null } = {}) {
  const headers = { authorization: `Bearer ${token}` };
  if (body !== null) headers['content-type'] = 'application/json';
  const response = await fetch(new URL(pathname, baseUrl), {
    method,
    headers,
    body: body === null ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok) throw new Error(`Onboarding API ${method} ${pathname} failed with HTTP ${response.status}`);
  return payload;
}

async function prepareOnboarding(baseUrl, token) {
  const initial = await apiJson(baseUrl, token, '/api/onboarding/status');
  let action = 'already-complete';
  if (initial?.required === true) {
    await apiJson(baseUrl, token, '/api/onboarding/recommended', {
      method: 'POST',
      body: { primaryUse: 'software' },
    });
    action = 'recommended-defaults';
  }
  const final = await apiJson(baseUrl, token, '/api/onboarding/status');
  if (final?.required === true) throw new Error('Supported onboarding preparation did not reach a completed state');
  return Object.freeze({
    schema: 'nolane.ui.performance-onboarding-setup.v1',
    initialRequired: initial?.required === true,
    action,
    finalRequired: final?.required === true,
    completionSource: typeof final?.state?.source === 'string' ? final.state.source : null,
  });
}

async function preparePerformanceReviewFixture(baseUrl, token) {
  const project = await apiJson(baseUrl, token, '/api/projects', {
    method: 'POST',
    body: {
      name: `Performance review fixture ${Date.now()}`,
      workspaceRoot: process.cwd(),
      metadata: { evidenceFixture: 'task11-performance-review-v1' },
    },
  });
  const mission = await apiJson(baseUrl, token, '/api/missions/plan', {
    method: 'POST',
    body: {
      projectId: project?.id,
      objective: 'Measure evidence-bound review interaction without weakening snapshot truth',
      plan: {
        summary: 'Create a bounded performance review fixture.',
        tasks: [{
          id: 'review',
          title: 'Review exact diff truth',
          objective: 'Keep review decisions bound to the current snapshot.',
          role: 'reviewer',
          dependencies: [],
          allowedPaths: ['**'],
          deniedPaths: ['.env', '.env.*'],
        }],
      },
    },
  });
  const review = await apiJson(baseUrl, token, `/api/agent/runs/${encodeURIComponent(String(mission?.id ?? ''))}/diff-review`);
  if (!project?.id || !mission?.id || !/^[a-f0-9]{64}$/i.test(String(review?.reviewSha256 ?? ''))) {
    throw new Error('Performance review fixture did not produce an evidence-bound review snapshot');
  }
  return Object.freeze({
    projectId: String(project.id),
    missionId: String(mission.id),
    reviewSha256: String(review.reviewSha256),
  });
}

function percentile(values, ratio) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index];
}

function performanceMetricMap(metrics = []) {
  return Object.fromEntries(metrics.map(({ name, value }) => [name, Number(value)]));
}

async function cdpSnapshot(session) {
  const [{ metrics }, dom] = await Promise.all([
    session.send('Performance.getMetrics'),
    session.send('Memory.getDOMCounters'),
  ]);
  const values = performanceMetricMap(metrics);
  return Object.freeze({
    taskDurationSeconds: Number(values.TaskDuration ?? 0),
    jsHeapUsedBytes: Number(values.JSHeapUsedSize ?? 0),
    domNodes: Number(dom.nodes ?? 0),
    documents: Number(dom.documents ?? 0),
    jsEventListeners: Number(dom.jsEventListeners ?? 0),
  });
}

async function warmRoute(page, route) {
  await page.evaluate(({ target, id }) => {
    window.__nolanePerfPhase = `warmup:${id}`;
    location.hash = target;
  }, { target: route.route, id: route.id });
  await page.locator(route.selector).waitFor({ state: 'visible', timeout: 10_000 });
}

async function measureRouteSwitch(page, route) {
  const started = performance.now();
  await page.evaluate(({ target, id }) => {
    window.__nolanePerfPhase = `route:${id}`;
    location.hash = target;
  }, { target: route.route, id: route.id });
  await page.locator(route.selector).waitFor({ state: 'visible', timeout: 10_000 });
  return performance.now() - started;
}

async function measureSettingsInputToPaint(page) {
  const settingsRoute = ROUTES.find((route) => route.id === 'settings');
  if (!settingsRoute) throw new Error('Settings performance route is missing');
  await warmRoute(page, settingsRoute);
  const samples = await page.evaluate(async () => {
    const values = ['a', 'ap', 'app', 'appe', 'appear'];
    const durations = [];
    const nextPaint = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    for (const value of values) {
      const input = document.querySelector('[data-settings-search]');
      if (!(input instanceof HTMLInputElement)) throw new Error('Settings search input is unavailable');
      const started = performance.now();
      input.value = value;
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value.at(-1) ?? null }));
      await nextPaint();
      durations.push(performance.now() - started);
    }
    const input = document.querySelector('[data-settings-search]');
    if (input instanceof HTMLInputElement) {
      input.value = '';
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward', data: null }));
      await nextPaint();
    }
    return durations;
  });
  return Object.freeze({ samples: Object.freeze(samples), p95: percentile(samples, 0.95) });
}

function budgetObservation(value, target, comparator = '<=') {
  const measured = Number(value);
  const withinTarget = Number.isFinite(measured) && (comparator === '<' ? measured < target : measured <= target);
  return Object.freeze({ value: Number.isFinite(measured) ? measured : null, target, comparator, withinTarget });
}

export function evaluatePerformanceCandidate(metrics) {
  return Object.freeze({
    homeInteractive: budgetObservation(metrics.homeInteractiveMs, PERFORMANCE_BUDGETS.homeInteractiveMs),
    routeSwitchP95: budgetObservation(metrics.routeSwitchP95Ms, PERFORMANCE_BUDGETS.routeSwitchP95Ms),
    interactiveInputP95: budgetObservation(metrics.interactiveInputP95Ms, PERFORMANCE_BUDGETS.interactiveInputP95Ms),
    longTaskMax: budgetObservation(metrics.longTaskMaxMs, PERFORMANCE_BUDGETS.longTaskMaxMs),
    idleCpu: budgetObservation(metrics.idleCpuEstimatePercent, PERFORMANCE_BUDGETS.idleCpuPercent, '<'),
    homeDomNodes: budgetObservation(metrics.homeDomNodes, PERFORMANCE_BUDGETS.homeDomNodes, '<'),
    rendererMemoryProxy: Object.freeze({
      ...budgetObservation(metrics.rendererJsHeapUsedBytes, PERFORMANCE_BUDGETS.homeRendererMemoryBytes, '<'),
      evidenceQuality: 'proxy_only',
      note: 'JSHeapUsedSize is not full renderer RSS and cannot independently certify the renderer-memory budget.',
    }),
  });
}

export async function captureUiPerformanceEvidence({ baseUrl, token, outputDirectory, idleWindowMs = 3000 } = {}) {
  const root = path.resolve(required(outputDirectory, 'outputDirectory'));
  const runtimeUrl = required(baseUrl, 'baseUrl');
  const credential = required(token, 'token');
  const machine = machineSnapshot();
  await mkdir(root, { recursive: true });
  let browser = null;
  let onboardingSetup = null;
  let reviewFixture = null;
  let routes = ROUTES;
  try {
    onboardingSetup = await prepareOnboarding(runtimeUrl, credential);
    reviewFixture = await preparePerformanceReviewFixture(runtimeUrl, credential);
    routes = Object.freeze([...ROUTES, Object.freeze({ id: 'review', route: `/review/${encodeURIComponent(reviewFixture.missionId)}`, selector: '.review-detail' })]);
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ headless: true, args: ['--enable-precise-memory-info'] });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await context.addInitScript(() => {
      window.__nolaneLongTasks = [];
      window.__nolanePerfPhase = 'startup';
      if ('PerformanceObserver' in window) {
        try {
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              window.__nolaneLongTasks.push({
                duration: entry.duration,
                startTime: entry.startTime,
                phase: window.__nolanePerfPhase,
              });
            }
          });
          observer.observe({ type: 'longtask', buffered: true });
        } catch {}
      }
    });
    const page = await context.newPage();
    const session = await context.newCDPSession(page);
    await session.send('Performance.enable');

    const coldStarted = performance.now();
    await page.goto(stateUrl(runtimeUrl, credential, '/'), { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.locator('.app-shell').waitFor({ state: 'visible', timeout: 10_000 });
    const shellVisibleAt = performance.now();
    await page.locator('.home-view').waitFor({ state: 'visible', timeout: 10_000 });
    const homeVisibleAt = performance.now();
    const coldPageToHomeMs = homeVisibleAt - coldStarted;
    const homeInteractiveMs = homeVisibleAt - shellVisibleAt;
    const startupLongTaskRecords = await page.evaluate(() => Array.isArray(window.__nolaneLongTasks) ? [...window.__nolaneLongTasks] : []);
    const startupLongTaskMaxMs = startupLongTaskRecords.length ? Math.max(...startupLongTaskRecords.map((item) => Number(item.duration) || 0)) : 0;
    const homeSnapshot = await cdpSnapshot(session);

    const routeResourceObservations = {};
    for (const route of routes) {
      await warmRoute(page, route);
      routeResourceObservations[route.id] = await cdpSnapshot(session);
    }
    await page.evaluate(() => { window.__nolaneLongTasks = []; window.__nolanePerfPhase = 'interaction-ready'; });
    const routeSwitchSamplesMs = [];
    const routeSwitchSamplesByRoute = Object.fromEntries(routes.map((route) => [route.id, []]));
    for (let round = 0; round < 3; round += 1) {
      for (const route of routes) {
        const duration = await measureRouteSwitch(page, route);
        routeSwitchSamplesMs.push(duration);
        routeSwitchSamplesByRoute[route.id].push(duration);
      }
    }
    const routeSwitchP95Ms = percentile(routeSwitchSamplesMs, 0.95);
    const routeSwitchP95ByRoute = Object.freeze(Object.fromEntries(Object.entries(routeSwitchSamplesByRoute).map(([id, samples]) => [id, percentile(samples, 0.95)])));
    const interactiveInput = await measureSettingsInputToPaint(page);
    const routeLongTaskRecords = await page.evaluate(() => Array.isArray(window.__nolaneLongTasks) ? [...window.__nolaneLongTasks] : []);

    await warmRoute(page, routes.find((route) => route.id === 'home') ?? routes[0]);
    await page.evaluate(() => { window.__nolaneLongTasks = []; window.__nolanePerfPhase = 'idle'; });
    const idleBefore = await cdpSnapshot(session);
    const idleStarted = performance.now();
    await page.waitForTimeout(idleWindowMs);
    const idleAfter = await cdpSnapshot(session);
    const idleElapsedSeconds = Math.max((performance.now() - idleStarted) / 1000, 0.001);
    const idleTaskSeconds = Math.max(0, idleAfter.taskDurationSeconds - idleBefore.taskDurationSeconds);
    const idleCpuEstimatePercent = (idleTaskSeconds / idleElapsedSeconds) * 100;
    const idleLongTaskRecords = await page.evaluate(() => Array.isArray(window.__nolaneLongTasks) ? [...window.__nolaneLongTasks] : []);

    const longTaskRecords = [...routeLongTaskRecords, ...idleLongTaskRecords];
    const longTaskDurationsMs = longTaskRecords.map((item) => Number(item.duration) || 0);
    const longTaskMaxMs = longTaskDurationsMs.length ? Math.max(...longTaskDurationsMs) : 0;
    const metrics = Object.freeze({
      readyToShowMs: null,
      coldPageToHomeMs,
      homeInteractiveMs,
      routeSwitchP95Ms,
      routeSwitchSamplesMs: Object.freeze(routeSwitchSamplesMs),
      routeSwitchP95ByRoute,
      routeResourceObservations: Object.freeze(routeResourceObservations),
      interactiveInputP95Ms: interactiveInput.p95,
      interactiveInputSamplesMs: interactiveInput.samples,
      rendererJsHeapUsedBytes: homeSnapshot.jsHeapUsedBytes,
      homeDomNodes: homeSnapshot.domNodes,
      homeDocuments: homeSnapshot.documents,
      homeJsEventListeners: homeSnapshot.jsEventListeners,
      startupLongTaskCount: startupLongTaskRecords.length,
      startupLongTaskMaxMs,
      startupLongTaskRecords: Object.freeze(startupLongTaskRecords),
      longTaskCount: longTaskRecords.length,
      longTaskMaxMs,
      longTaskDurationsMs: Object.freeze(longTaskDurationsMs),
      longTaskRecords: Object.freeze(longTaskRecords),
      idleCpuEstimatePercent,
      idleWindowMs,
    });
    const payload = Object.freeze({
      schema: 'nolane.ui.performance-runtime-evidence.v1',
      evidenceClass: 'runtime_candidate',
      certificationState: 'candidate_unverified',
      finalDecision: 'external_gate',
      requirementProjection: Object.freeze({ 'NOL-UI-032': 'external_gate', 'NOL-UI-002': 'external_gate' }),
      machine,
      setup: Object.freeze({ onboarding: onboardingSetup, reviewFixture }),
      budgets: PERFORMANCE_BUDGETS,
      metrics,
      budgetObservations: evaluatePerformanceCandidate(metrics),
      observability: Object.freeze({
        readyToShow: 'not_observed_source_runtime_is_not_electron_launch',
        homeInteractive: 'source_shell_visible_proxy_not_electron_window_show',
        coldBootstrap: 'observed_separately_not_compared_to_home_interactive_budget',
        rendererMemory: 'proxy_only_js_heap_not_full_renderer_rss',
        windows8Gb: machine.os === 'win32' && Math.abs(machine.ramGb - 8) < 0.25 ? 'target_machine_candidate' : 'not_target_machine',
        independentReview: false,
        visualBudget: 'separate_ui_runtime_visual_receipt_required',
        interactiveInput: 'settings_search_input_to_two_animation_frames_source_runtime_proxy',
        streamingInputResponsiveness: 'not_observed_no_replayable_stream_fixture',
        changedSurfaceRoutes: Object.freeze(['missions', 'review', 'workroom', 'browser', 'settings', 'control-plane']),
      }),
      claims: Object.freeze({ windows8GbCertified: false, performanceCertified: false }),
    });
    const receiptSha256 = sha256(JSON.stringify(payload));
    await writeFile(path.join(root, 'receipt.json'), `${JSON.stringify({ ...payload, receiptSha256 }, null, 2)}\n`);
    return Object.freeze({ output: root, receiptSha256, metrics, budgetObservations: payload.budgetObservations });
  } catch (error) {
    const message = redact(error?.message ?? error);
    const failure = Object.freeze({
      schema: 'nolane.ui.performance-runtime-failure.v1',
      evidenceClass: 'runtime_candidate',
      certificationState: 'candidate_unverified',
      finalDecision: 'external_gate',
      requirementProjection: Object.freeze({ 'NOL-UI-032': 'external_gate', 'NOL-UI-002': 'external_gate' }),
      machine,
      setup: onboardingSetup,
      message,
    });
    const receiptSha256 = sha256(JSON.stringify(failure));
    await writeFile(path.join(root, 'failure.json'), `${JSON.stringify({ ...failure, receiptSha256 }, null, 2)}\n`);
    throw new Error(message);
  } finally {
    await browser?.close().catch(() => {});
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) captureUiPerformanceEvidence({
  baseUrl: process.env.NOLANE_UI_RUNTIME_URL,
  token: process.env.NOLANE_AGENT_TOKEN,
  outputDirectory: process.env.NOLANE_UI_PERFORMANCE_OUTPUT,
}).then((result) => console.log(JSON.stringify({ receiptSha256: result.receiptSha256, metrics: result.metrics }))).catch((error) => {
  console.error(error.stack ?? error);
  process.exitCode = 1;
});
