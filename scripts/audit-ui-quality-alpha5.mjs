#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const sha256 = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const normalize = (value) => String(value).replaceAll('\\', '/');

async function walk(root, current = root) {
  const output = [];
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const full = path.join(current, entry.name);
    if (entry.isDirectory()) output.push(...await walk(root, full));
    else if (entry.isFile() && /\.(?:css|html|js|mjs)$/.test(entry.name)) output.push(full);
  }
  return output.sort();
}

export async function auditUiQuality({ root } = {}) {
  const uiRoot = path.join(root, 'ui-v3');
  const files = await walk(uiRoot);
  const entries = await Promise.all(files.map(async (file) => ({ path: normalize(path.relative(root, file)), text: await readFile(file, 'utf8') })));
  const all = entries.map((entry) => entry.text).join('\n');
  const fileText = (suffix) => entries.find((entry) => entry.path.endsWith(suffix))?.text ?? '';
  const accessibilityFindings = [];
  const responsiveFindings = [];
  const offlineFindings = [];

  if (!/prefers-reduced-motion\s*:\s*reduce/.test(all)) accessibilityFindings.push('missing-prefers-reduced-motion');
  if (!/input:focus-visible/.test(all) || !/textarea:focus-visible/.test(all) || !/select:focus-visible/.test(all)) accessibilityFindings.push('incomplete-focus-visible-contract');
  if (!/aria-live="polite"/.test(fileText('shell/app-shell.mjs')) || !/aria-atomic="true"/.test(fileText('shell/app-shell.mjs'))) accessibilityFindings.push('missing-route-live-region');
  const dock = fileText('views/mission/artifact-dock.mjs');
  if (!/aria-controls=/.test(dock) || !/role="tabpanel"/.test(dock) || !/aria-labelledby=/.test(dock)) accessibilityFindings.push('artifact-tab-relationship-incomplete');
  if (/animation-iteration-count\s*:\s*infinite/i.test(all)) accessibilityFindings.push('unbounded-animation');

  const breakpoints = [...all.matchAll(/breakpoint:\s*(\d+)/g)].map((match) => Number(match[1])).filter(Number.isFinite);
  for (const expected of [1440, 1180, 980, 640]) if (!breakpoints.includes(expected)) responsiveFindings.push(`missing-breakpoint-${expected}`);
  if (!/@media\s*\(max-width:979px\)/.test(all)) responsiveFindings.push('missing-narrow-workspace-contract');

  for (const entry of entries) {
    const external = entry.text.match(/(?:src|href)=["']https?:\/\/[^"']+|@import\s+(?:url\()?['"]?https?:\/\//gi) ?? [];
    for (const match of external) offlineFindings.push(`${entry.path}:${match}`);
  }

  accessibilityFindings.sort(); responsiveFindings.sort(); offlineFindings.sort();
  const base = {
    schema: 'nolane.ui.static-quality-audit.v1',
    product: 'Nolane Agent',
    filesScanned: entries.length,
    breakpoints: Object.freeze([...new Set(breakpoints)].sort((a, b) => a - b)),
    accessibilityFindings: Object.freeze(accessibilityFindings),
    responsiveFindings: Object.freeze(responsiveFindings),
    offlineFindings: Object.freeze(offlineFindings),
    staticCertification: accessibilityFindings.length === 0 && responsiveFindings.length === 0 && offlineFindings.length === 0,
    runtimeCertification: false,
    runtimeCertificationReason: 'Static source audit cannot replace keyboard, screen-reader, visual-regression, contrast, or Windows performance execution.',
  };
  return Object.freeze({ ...base, receiptSha256: sha256(base) });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const report = await auditUiQuality({ root: process.cwd() });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.staticCertification) process.exitCode = 1;
}
