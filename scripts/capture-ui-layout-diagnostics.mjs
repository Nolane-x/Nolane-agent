#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE = String(process.env.NOLANE_UI_RUNTIME_URL ?? '').trim();
const TOKEN = String(process.env.NOLANE_AGENT_TOKEN ?? '').trim();
const OUTPUT = path.resolve(process.env.NOLANE_UI_LAYOUT_DIAGNOSTICS_OUTPUT ?? 'artifacts/ui-layout-diagnostics');
if (!BASE || !TOKEN) throw new TypeError('NOLANE_UI_RUNTIME_URL and NOLANE_AGENT_TOKEN are required');

const CASES = Object.freeze([
  Object.freeze({ id: 'fresh-1440', viewport: { width: 1440, height: 1000 }, mode: 'fresh' }),
  Object.freeze({ id: 'fresh-980', viewport: { width: 980, height: 1000 }, mode: 'fresh' }),
  Object.freeze({ id: 'roundtrip-1440', viewport: { width: 1440, height: 1000 }, mode: 'roundtrip' }),
  Object.freeze({ id: 'roundtrip-980', viewport: { width: 980, height: 1000 }, mode: 'roundtrip' }),
]);

function stateUrl(route) {
  const target = new URL(BASE);
  const routeUrl = new URL(route, target);
  routeUrl.searchParams.set('token', TOKEN);
  target.hash = `${routeUrl.pathname}${routeUrl.search}`;
  return target.toString();
}

async function ensureProjectFixture() {
  const response = await fetch(new URL('/api/projects', BASE), { headers: { authorization: `Bearer ${TOKEN}` } });
  if (!response.ok) throw new Error(`GET /api/projects failed: ${response.status}`);
  const payload = await response.json();
  const projects = Array.isArray(payload) ? payload : payload?.projects ?? [];
  if (projects.length) return projects[0];
  const created = await fetch(new URL('/api/projects', BASE), {
    method: 'POST',
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Product Perfection Diagnostic Fixture', workspaceRoot: process.cwd(), metadata: { evidenceFixture: 'projects-layout-diagnostics-v1' } }),
  });
  if (!created.ok) throw new Error(`POST /api/projects failed: ${created.status} ${await created.text()}`);
  return created.json();
}

function roundRect(rect) {
  if (!rect) return null;
  return Object.fromEntries(['x', 'y', 'top', 'right', 'bottom', 'left', 'width', 'height'].map((key) => [key, Math.round(Number(rect[key]) * 100) / 100]));
}

export async function captureProjectsLayout(page, diagnosticCase) {
  const result = await page.evaluate(({ caseId, mode }) => {
    const rect = (selector) => {
      const node = document.querySelector(selector);
      return node ? node.getBoundingClientRect().toJSON() : null;
    };
    const projects = document.querySelector('.projects-page');
    const workspace = document.querySelector('#workspace');
    const firstRecord = document.querySelector('.project-card, .project-activity, .page-empty, .page-error, .page-loading');
    const styleOf = (node) => {
      if (!node) return null;
      const style = getComputedStyle(node);
      return {
        display: style.display,
        position: style.position,
        boxSizing: style.boxSizing,
        marginTop: style.marginTop,
        marginBottom: style.marginBottom,
        paddingTop: style.paddingTop,
        paddingBottom: style.paddingBottom,
        minHeight: style.minHeight,
        height: style.height,
        transform: style.transform,
        alignSelf: style.alignSelf,
        justifySelf: style.justifySelf,
        placeSelf: style.placeSelf,
        overflowY: style.overflowY,
      };
    };
    const ancestorChain = [];
    for (let node = projects; node && ancestorChain.length < 8; node = node.parentElement) {
      ancestorChain.push({
        tag: node.tagName.toLowerCase(),
        id: node.id || null,
        className: typeof node.className === 'string' ? node.className : null,
        rect: node.getBoundingClientRect().toJSON(),
        computedStyle: styleOf(node),
      });
    }
    return {
      caseId,
      mode,
      hash: location.hash,
      experience: document.querySelector('.app-shell')?.dataset?.progressiveExperience ?? null,
      workspaceScrollTop: workspace?.scrollTop ?? null,
      workspaceScrollHeight: workspace?.scrollHeight ?? null,
      workspaceClientHeight: workspace?.clientHeight ?? null,
      documentScrollTop: document.scrollingElement?.scrollTop ?? null,
      workspaceRect: rect('#workspace'),
      contentRect: rect('.projects-page'),
      headerRect: rect('.projects-page > .surface-page__header'),
      toolbarRect: rect('.projects-page > .surface-toolbar'),
      firstRecordRect: firstRecord?.getBoundingClientRect().toJSON() ?? null,
      computedStyle: {
        workspace: styleOf(workspace),
        content: styleOf(projects),
        header: styleOf(document.querySelector('.projects-page > .surface-page__header')),
      },
      activeElement: document.activeElement ? {
        tag: document.activeElement.tagName.toLowerCase(),
        id: document.activeElement.id || null,
        className: typeof document.activeElement.className === 'string' ? document.activeElement.className : null,
      } : null,
      restoredViewState: {
        sessionRestoreMarker: document.documentElement.dataset.sessionRestore ?? null,
        workspaceHasFocus: document.activeElement === workspace,
      },
      ancestorChain,
    };
  }, { caseId: diagnosticCase.id, mode: diagnosticCase.mode });

  const rounded = structuredClone(result);
  for (const key of ['workspaceRect', 'contentRect', 'headerRect', 'toolbarRect', 'firstRecordRect']) rounded[key] = roundRect(rounded[key]);
  for (const item of rounded.ancestorChain ?? []) item.rect = roundRect(item.rect);
  return rounded;
}

async function runCase(browser, diagnosticCase) {
  const context = await browser.newContext({ viewport: diagnosticCase.viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  try {
    if (diagnosticCase.mode === 'roundtrip') {
      await page.goto(stateUrl('/'), { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.locator('.home-view').waitFor({ state: 'visible', timeout: 30_000 });
      await page.evaluate(() => {
        const workspace = document.querySelector('#workspace');
        if (workspace) workspace.scrollTop = Math.min(240, Math.max(0, workspace.scrollHeight - workspace.clientHeight));
        location.hash = '/projects';
      });
    } else {
      await page.goto(stateUrl('/projects'), { waitUntil: 'domcontentloaded', timeout: 30_000 });
    }
    await page.locator('.projects-page').waitFor({ state: 'visible', timeout: 30_000 });
    await page.waitForTimeout(500);
    const diagnostics = await captureProjectsLayout(page, diagnosticCase);
    const screenshot = `${diagnosticCase.id}.png`;
    await page.screenshot({ path: path.join(OUTPUT, screenshot), fullPage: true, animations: 'disabled' });
    return { ...diagnostics, viewport: diagnosticCase.viewport, screenshot };
  } finally {
    await context.close();
  }
}

export async function captureUiLayoutDiagnostics() {
  await mkdir(OUTPUT, { recursive: true });
  const fixture = await ensureProjectFixture();
  const browser = await chromium.launch({ headless: true });
  try {
    const cases = [];
    for (const diagnosticCase of CASES) cases.push(await runCase(browser, diagnosticCase));
    const report = {
      schema: 'nolane.ui.projects-layout-diagnostics.v1',
      fixture: { projectId: fixture?.id ?? null, projectName: fixture?.name ?? null },
      cases,
    };
    await writeFile(path.join(OUTPUT, 'projects-layout-diagnostics.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    return report;
  } finally {
    await browser.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  captureUiLayoutDiagnostics().then((report) => {
    console.log(JSON.stringify({ schema: report.schema, cases: report.cases.map(({ caseId, workspaceScrollTop, contentRect, firstRecordRect }) => ({ caseId, workspaceScrollTop, contentRect, firstRecordRect })) }, null, 2));
  }).catch((error) => {
    console.error(error.stack ?? error);
    process.exitCode = 1;
  });
}
