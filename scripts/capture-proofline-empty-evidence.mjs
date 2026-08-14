#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';

const STATES = Object.freeze([
  Object.freeze({ id: 'mission-proofline-empty', viewport: Object.freeze({ width: 1440, height: 1000 }) }),
  Object.freeze({ id: 'mission-proofline-empty-compact', viewport: Object.freeze({ width: 820, height: 1000 }) }),
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

async function completeOnboarding(root, credential) {
  const response = await fetch(new URL('/api/onboarding/recommended', root), {
    method: 'POST',
    headers: { authorization: `Bearer ${credential}`, 'content-type': 'application/json' },
    body: JSON.stringify({ primaryUse: 'chat' }),
  });
  if (!response.ok && response.status !== 409) {
    throw new Error(`onboarding preparation failed with ${response.status}`);
  }
}

async function assertProoflineEmptyState(page, state) {
  const spotlightCount = await page.locator('.mission-spotlight').count();
  if (spotlightCount !== 0) throw new Error(`${state.id} selected mission spotlight remained visible`);
  const recoveryCount = await page.locator('.time-travel').count();
  if (recoveryCount !== 0) throw new Error(`${state.id} recovery deck rendered without a selected mission`);

  const layout = await page.evaluate(() => {
    const root = document.querySelector('.activity-page');
    const toolbar = document.querySelector('.activity-toolbar');
    const ledger = document.querySelector('.activity-filament');
    if (!root || !toolbar || !ledger) return { error: 'empty Proofline semantic regions are missing' };
    const box = (node) => {
      const rect = node.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width };
    };
    return {
      root: box(root),
      toolbar: box(toolbar),
      ledger: box(ledger),
      toolbarGridColumn: `${getComputedStyle(toolbar).gridColumnStart}/${getComputedStyle(toolbar).gridColumnEnd}`,
      ledgerGridColumn: `${getComputedStyle(ledger).gridColumnStart}/${getComputedStyle(ledger).gridColumnEnd}`,
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body?.scrollWidth ?? 0,
    };
  });
  if (layout.error) throw new Error(layout.error);

  const tolerance = 4;
  const toolbarSpans = Math.abs(layout.toolbar.left - layout.root.left) <= tolerance
    && Math.abs(layout.toolbar.right - layout.root.right) <= tolerance;
  if (!toolbarSpans) {
    throw new Error(`${state.id} empty mission toolbar did not span the available activity lane: ${JSON.stringify(layout)}`);
  }
  const ledgerSpans = Math.abs(layout.ledger.left - layout.root.left) <= tolerance
    && Math.abs(layout.ledger.right - layout.root.right) <= tolerance;
  if (!ledgerSpans) {
    throw new Error(`${state.id} empty mission ledger did not span the available activity lane: ${JSON.stringify(layout)}`);
  }
  const renderedWidth = Math.max(layout.documentWidth, layout.bodyWidth);
  if (renderedWidth > layout.viewportWidth + 1) {
    throw new Error(`${state.id} empty mission layout overflows horizontally: ${renderedWidth}px > ${layout.viewportWidth}px`);
  }

  const axe = await new AxeBuilder({ page }).include('.activity-page').withTags(WCAG_TAGS).analyze();
  const blocking = axe.violations.filter((violation) => ['serious', 'critical'].includes(String(violation.impact)));
  if (blocking.length) {
    const summary = blocking.flatMap((violation) => violation.nodes.slice(0, 10)
      .map((node) => `${violation.id} (${violation.impact}) at ${node.target.join(' ')}`)).join(', ');
    throw new Error(`${state.id} empty mission state reported serious or critical accessibility violations: ${summary}`);
  }

  return Object.freeze({
    selectedMissionSpotlight: 'ABSENT',
    recoveryDeck: 'ABSENT',
    emptyMissionLayout: 'PASS',
    toolbarGridColumn: layout.toolbarGridColumn,
    ledgerGridColumn: layout.ledgerGridColumn,
    axeSeriousCritical: 'PASS',
    horizontalOverflow: 'PASS',
    screenReader: 'UNKNOWN',
  });
}

export async function captureProoflineEmptyEvidence({ baseUrl, token, outputDirectory } = {}) {
  const root = required(baseUrl, 'baseUrl');
  const credential = required(token, 'token');
  const output = path.resolve(required(outputDirectory, 'outputDirectory'));
  await mkdir(output, { recursive: true });
  await completeOnboarding(root, credential);

  const browser = await chromium.launch({ headless: true });
  const captures = [];
  try {
    for (const state of STATES) {
      const context = await browser.newContext({ viewport: state.viewport, deviceScaleFactor: 1 });
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(String(error?.message ?? error)));
      await page.goto(stateUrl(root, credential, '/missions'), { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.locator('.activity-page').waitFor({ state: 'visible', timeout: 30_000 });
      await page.waitForTimeout(250);

      const runtimeAssertions = await assertProoflineEmptyState(page, state);
      if (pageErrors.length) throw new Error(`${state.id} emitted page errors: ${pageErrors.join(' | ')}`);

      const filename = `${state.id}.png`;
      const file = path.join(output, filename);
      await page.screenshot({ path: file, fullPage: false, animations: 'disabled' });
      const body = await readFile(file);
      captures.push(Object.freeze({
        id: state.id,
        route: '/missions',
        viewport: Object.freeze({ ...state.viewport, deviceScaleFactor: 1 }),
        file: filename,
        bytes: body.length,
        sha256: sha256(body),
        runtimeAssertions,
      }));
      await context.close();
    }
  } finally {
    await browser.close();
  }

  const report = Object.freeze({
    schema: 'nolane.ui.proofline-empty-runtime-receipt.v1',
    captures: Object.freeze(captures),
    claims: Object.freeze({
      unselectedMissionObserved: true,
      desktopAndCompactObserved: true,
      generatorSelfCertification: false,
      independentScreenReaderEvidence: 'UNKNOWN',
    }),
  });
  const receiptSha256 = sha256(JSON.stringify(report));
  await writeFile(path.join(output, 'receipt.json'), `${JSON.stringify({ ...report, receiptSha256 }, null, 2)}\n`);
  return Object.freeze({ output, captures, receiptSha256 });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) captureProoflineEmptyEvidence({
  baseUrl: process.env.NOLANE_UI_RUNTIME_URL,
  token: process.env.NOLANE_AGENT_TOKEN,
  outputDirectory: process.env.NOLANE_UI_EMPTY_OUTPUT,
}).then((result) => console.log(JSON.stringify({ captures: result.captures.length, receiptSha256: result.receiptSha256 }))).catch((error) => {
  console.error(error.stack ?? error);
  process.exitCode = 1;
});
