#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';

const STATES = Object.freeze([
  Object.freeze({ id: 'mission-proofline-ledger', viewport: Object.freeze({ width: 1440, height: 1000 }) }),
  Object.freeze({ id: 'mission-proofline-ledger-compact', viewport: Object.freeze({ width: 820, height: 1000 }) }),
  Object.freeze({ id: 'mission-proofline-ledger-nocturne', viewport: Object.freeze({ width: 1440, height: 1000 }), theme: 'nocturne' }),
]);
const WCAG_TAGS = Object.freeze(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

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

async function apiRequest(root, credential, pathname, { method = 'GET', body = null, tolerateFailure = false } = {}) {
  const response = await fetch(new URL(pathname, root), {
    method,
    headers: {
      authorization: `Bearer ${credential}`,
      ...(body == null ? {} : { 'content-type': 'application/json' }),
    },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  if (!response.ok && !tolerateFailure) {
    throw new Error(`${method} ${pathname} failed with ${response.status}: ${typeof payload === 'string' ? payload : JSON.stringify(payload)}`);
  }
  return Object.freeze({ ok: response.ok, status: response.status, payload });
}

async function createFixture(root, credential) {
  await apiRequest(root, credential, '/api/onboarding/recommended', {
    method: 'POST',
    body: { primaryUse: 'chat' },
    tolerateFailure: true,
  });

  const projectResult = await apiRequest(root, credential, '/api/projects', {
    method: 'POST',
    body: {
      name: 'NUI Proofline Ledger Evidence',
      workspaceRoot: process.cwd(),
      metadata: { evidenceFixture: 'mission-proofline-ledger-runtime-v1' },
    },
  });
  const project = projectResult.payload;
  const objective = 'Verify Proofline ledger readability and receipt discoverability under real scrolling';
  const missionResult = await apiRequest(root, credential, '/api/missions/plan', {
    method: 'POST',
    body: {
      projectId: project.id,
      objective,
      plan: {
        summary: 'Render the durable execution ledger, preserve evidence lineage, and expose recovery receipts.',
        tasks: [
          { id: 'inspect', title: 'Inspect evidence lineage', objective: 'Inspect mission and receipt lineage.', role: 'scout', dependencies: [], allowedPaths: ['src/**', 'tests/**'], deniedPaths: ['.env', '.env.*'] },
          { id: 'build', title: 'Render bounded Proofline', objective: 'Keep the ledger readable without changing host authority.', role: 'builder', dependencies: ['inspect'], allowedPaths: ['ui-v3/**', 'tests/**'], deniedPaths: ['.env', '.env.*'] },
          { id: 'verify', title: 'Independently inspect receipts', objective: 'Verify evidence remains discoverable and unresolved gates stay unknown.', role: 'reviewer', dependencies: ['build'], allowedPaths: ['**'], deniedPaths: ['.env', '.env.*'] },
        ],
      },
    },
  });
  const mission = missionResult.payload;

  const trust = await apiRequest(root, credential, `/api/workspace-trust/${encodeURIComponent(project.id)}`, {
    method: 'PUT',
    body: { reason: 'Ephemeral Proofline ledger runtime evidence fixture' },
    tolerateFailure: true,
  });
  let checkpoint = null;
  if (trust.ok) {
    const checkpointResult = await apiRequest(root, credential, '/api/time-travel/checkpoints', {
      method: 'POST',
      body: { missionId: mission.id, label: 'Before Proofline ledger evidence' },
      tolerateFailure: true,
    });
    if (checkpointResult.ok) checkpoint = checkpointResult.payload;
  }

  return Object.freeze({
    projectId: project.id,
    missionId: mission.id,
    objective,
    checkpointId: checkpoint?.id ?? null,
    checkpointEvidence: checkpoint ? 'AVAILABLE' : 'UNKNOWN',
  });
}

async function applyStateAppearance(root, credential, state) {
  if (!state.theme) return;
  await apiRequest(root, credential, '/api/settings', {
    method: 'PUT',
    body: {
      layer: 'user',
      patch: { appearance: { theme: state.theme, accent: 'emerald' } },
    },
  });
}

async function assertLedgerEvidence(page, state) {
  const ledger = page.locator('.activity-filament');
  await ledger.waitFor({ state: 'visible', timeout: 20_000 });
  await ledger.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);

  const receiptSummary = ledger.locator('details > summary').filter({ hasText: /Evidence receipt|Bằng chứng/i }).first();
  if (await receiptSummary.count() < 1) throw new Error(`${state.id} ledger exposed no discoverable evidence receipt`);
  await receiptSummary.scrollIntoViewIfNeeded();
  if (!await receiptSummary.evaluate((node) => Boolean(node.parentElement?.open))) await receiptSummary.click();
  await page.waitForTimeout(120);

  const metrics = await ledger.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const events = node.querySelectorAll('.activity-event');
    const visibleReceiptSummaries = [...node.querySelectorAll('details > summary')].filter((summary) => {
      const box = summary.getBoundingClientRect();
      const style = getComputedStyle(summary);
      return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    });
    const openReceiptCodes = [...node.querySelectorAll('details[open] code')].map((item) => String(item.textContent ?? '').trim()).filter(Boolean);
    return Object.freeze({
      top: rect.top,
      bottom: rect.bottom,
      viewportHeight: window.innerHeight,
      eventCount: events.length,
      visibleReceiptSummaryCount: visibleReceiptSummaries.length,
      openReceiptCount: openReceiptCodes.length,
      clientWidth: node.clientWidth,
      scrollWidth: node.scrollWidth,
    });
  });

  if (!(metrics.top < metrics.viewportHeight && metrics.bottom > 0)) throw new Error(`${state.id} ledger did not enter the viewport`);
  if (metrics.eventCount < 1) throw new Error(`${state.id} ledger rendered no activity events`);
  if (metrics.visibleReceiptSummaryCount < 1 || metrics.openReceiptCount < 1) throw new Error(`${state.id} ledger exposed no discoverable evidence receipt`);
  if (metrics.scrollWidth > metrics.clientWidth + 1) throw new Error(`${state.id} ledger overflows horizontally: ${metrics.scrollWidth}px > ${metrics.clientWidth}px`);

  const axe = await new AxeBuilder({ page }).include('.activity-filament').withTags(WCAG_TAGS).analyze();
  const blocking = axe.violations.filter((violation) => ['serious', 'critical'].includes(String(violation.impact)));
  if (blocking.length) {
    const summary = blocking.flatMap((violation) => violation.nodes.slice(0, 10).map((node) => `${violation.id} (${violation.impact}) at ${node.target.join(' ')}`)).join(', ');
    throw new Error(`${state.id} ledger reported serious or critical accessibility violations: ${summary}`);
  }

  return Object.freeze({
    ledgerInViewport: 'PASS',
    eventCount: metrics.eventCount,
    receiptDiscoverability: 'PASS',
    visibleReceiptSummaryCount: metrics.visibleReceiptSummaryCount,
    openReceiptCount: metrics.openReceiptCount,
    axeSeriousCritical: 'PASS',
    horizontalOverflow: 'PASS',
    screenReader: 'UNKNOWN',
  });
}

export async function captureProoflineLedgerEvidence({ baseUrl, token, outputDirectory } = {}) {
  const root = required(baseUrl, 'baseUrl');
  const credential = required(token, 'token');
  const output = path.resolve(required(outputDirectory, 'outputDirectory'));
  await mkdir(output, { recursive: true });
  const fixture = await createFixture(root, credential);
  const browser = await chromium.launch({ headless: true });
  const captures = [];
  try {
    for (const state of STATES) {
      await applyStateAppearance(root, credential, state);
      const context = await browser.newContext({ viewport: state.viewport, deviceScaleFactor: 1 });
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(String(error?.message ?? error)));
      await page.goto(stateUrl(root, credential, `/missions?id=${encodeURIComponent(fixture.missionId)}`), { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.locator('.activity-page').waitFor({ state: 'visible', timeout: 30_000 });
      await page.waitForFunction(({ missionId, objective }) => {
        const mission = document.querySelector('.mission-spotlight');
        return location.hash.includes(encodeURIComponent(missionId)) && mission?.textContent?.includes(objective);
      }, { missionId: fixture.missionId, objective: fixture.objective }, { timeout: 20_000 });
      if (state.theme) {
        await page.waitForFunction((theme) => document.documentElement.dataset.theme === theme, state.theme, { timeout: 10_000 });
      }

      const runtimeAssertions = await assertLedgerEvidence(page, state);
      if (pageErrors.length) throw new Error(`${state.id} emitted page errors: ${pageErrors.join(' | ')}`);
      const filename = `${state.id}.png`;
      const file = path.join(output, filename);
      await page.screenshot({ path: file, fullPage: false, animations: 'disabled' });
      const body = await readFile(file);
      captures.push(Object.freeze({
        id: state.id,
        route: '/missions',
        viewport: Object.freeze({ ...state.viewport, deviceScaleFactor: 1 }),
        appearance: Object.freeze({ theme: state.theme ?? 'default' }),
        file: filename,
        bytes: body.length,
        sha256: sha256(body),
        fixture: Object.freeze({ checkpointEvidence: fixture.checkpointEvidence }),
        runtimeAssertions,
      }));
      await context.close();
    }
  } finally {
    await browser.close();
  }

  const report = Object.freeze({
    schema: 'nolane.ui.proofline-ledger-runtime-receipt.v1',
    captures: Object.freeze(captures),
    claims: Object.freeze({
      ledgerViewportEvidence: true,
      receiptDiscoverabilityObserved: true,
      nocturneObserved: true,
      generatorSelfCertification: false,
      independentScreenReaderEvidence: 'UNKNOWN',
    }),
  });
  const receiptSha256 = sha256(JSON.stringify(report));
  await writeFile(path.join(output, 'receipt.json'), `${JSON.stringify({ ...report, receiptSha256 }, null, 2)}\n`);
  return Object.freeze({ output, captures, receiptSha256 });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) captureProoflineLedgerEvidence({
  baseUrl: process.env.NOLANE_UI_RUNTIME_URL,
  token: process.env.NOLANE_AGENT_TOKEN,
  outputDirectory: process.env.NOLANE_UI_LEDGER_OUTPUT,
}).then((result) => console.log(JSON.stringify({ captures: result.captures.length, receiptSha256: result.receiptSha256 }))).catch((error) => {
  console.error(error.stack ?? error);
  process.exitCode = 1;
});
