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
});

const ROUTES = Object.freeze([
  Object.freeze({ id: 'home', route: '/', selector: '.home-view' }),
  Object.freeze({ id: 'projects', route: '/projects', selector: '.projects-page' }),
  Object.freeze({ id: 'skills', route: '/skills', selector: '.skills-library' }),
  Object.freeze({ id: 'settings', route: '/settings', selector: '.settings-center' }),
  Object.freeze({ id: 'workroom', route: '/workroom', selector: '.workroom-view' }),
  Object.freeze({ id: 'control-plane', route: '/control-plane', selector: '#workspace' }),
]);

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const required = (value, name) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new TypeError(`${name} is required`);
  return normalized;
};

function stateUrl(baseUrl, token, route) {
  const root = new URL(baseUrl);
  const routeUrl = new URL(route, root);
  routeUrl.searchParams.set('token', token);
  root.hash = `${routeUrl.pathname}${routeUrl.search}`;
  return root.toString();
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
  await page.evaluate((target) => { location.hash = target; }, route.route);
  await page.locator(route.selector).waitFor({ state: 'visible', timeout: 10_000 });
}

async function measureRouteSwitch(page, route) {
  const started = performance.now();
  await page.evaluate((target) => { location.hash = target; }, route.route);
  await page.locator(route.selector).waitFor({ state: 'visible', timeout: 10_000 });
  return performance.now() - started;
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
  await mkdir(root, { recursive: true });
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true, args: ['--enable-precise-memory-info'] });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await context.addInitScript(() => {
      window.__nolaneLongTasks = [];
      if ('PerformanceObserver' in window) {
        try {
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) window.__nolaneLongTasks.push(entry.duration);
          });
          observer.observe({ type: 'longtask', buffered: true });
        } catch {}
      }
    });
    const page = await context.newPage();
    const session = await context.newCDPSession(page);
    await session.send('Performance.enable');

    const homeStarted = performance.now();
    await page.goto(stateUrl(required(baseUrl, 'baseUrl'), required(token, 'token'), '/'), { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.locator('.home-view').waitFor({ state: 'visible', timeout: 10_000 });
    const homeInteractiveMs = performance.now() - homeStarted;
    const homeSnapshot = await cdpSnapshot(session);

    for (const route of ROUTES) await warmRoute(page, route);
    const routeSwitchSamplesMs = [];
    for (let round = 0; round < 3; round += 1) {
      for (const route of ROUTES) routeSwitchSamplesMs.push(await measureRouteSwitch(page, route));
    }
    const routeSwitchP95Ms = percentile(routeSwitchSamplesMs, 0.95);

    await warmRoute(page, ROUTES[0]);
    const idleBefore = await cdpSnapshot(session);
    const idleStarted = performance.now();
    await page.waitForTimeout(idleWindowMs);
    const idleAfter = await cdpSnapshot(session);
    const idleElapsedSeconds = Math.max((performance.now() - idleStarted) / 1000, 0.001);
    const idleTaskSeconds = Math.max(0, idleAfter.taskDurationSeconds - idleBefore.taskDurationSeconds);
    const idleCpuEstimatePercent = (idleTaskSeconds / idleElapsedSeconds) * 100;

    const longTasks = await page.evaluate(() => Array.isArray(window.__nolaneLongTasks) ? [...window.__nolaneLongTasks] : []);
    const longTaskMaxMs = longTasks.length ? Math.max(...longTasks) : 0;
    const machine = Object.freeze({
      os: process.platform,
      arch: process.arch,
      ramGb: Number((os.totalmem() / 1024 ** 3).toFixed(2)),
      logicalCpuCount: os.cpus().length,
      cpuModel: os.cpus()[0]?.model ?? 'unknown',
    });
    const metrics = Object.freeze({
      readyToShowMs: null,
      homeInteractiveMs,
      routeSwitchP95Ms,
      routeSwitchSamplesMs: Object.freeze(routeSwitchSamplesMs),
      rendererJsHeapUsedBytes: homeSnapshot.jsHeapUsedBytes,
      homeDomNodes: homeSnapshot.domNodes,
      homeDocuments: homeSnapshot.documents,
      homeJsEventListeners: homeSnapshot.jsEventListeners,
      longTaskCount: longTasks.length,
      longTaskMaxMs,
      longTaskDurationsMs: Object.freeze(longTasks),
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
      budgets: PERFORMANCE_BUDGETS,
      metrics,
      budgetObservations: evaluatePerformanceCandidate(metrics),
      observability: Object.freeze({
        readyToShow: 'not_observed_source_runtime_is_not_electron_launch',
        rendererMemory: 'proxy_only_js_heap_not_full_renderer_rss',
        windows8Gb: machine.os === 'win32' && Math.abs(machine.ramGb - 8) < 0.25 ? 'target_machine_candidate' : 'not_target_machine',
        independentReview: false,
        visualBudget: 'separate_ui_runtime_visual_receipt_required',
      }),
      claims: Object.freeze({ windows8GbCertified: false, performanceCertified: false }),
    });
    const receiptSha256 = sha256(JSON.stringify(payload));
    await writeFile(path.join(root, 'receipt.json'), `${JSON.stringify({ ...payload, receiptSha256 }, null, 2)}\n`);
    return Object.freeze({ output: root, receiptSha256, metrics, budgetObservations: payload.budgetObservations });
  } finally {
    await browser.close();
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
