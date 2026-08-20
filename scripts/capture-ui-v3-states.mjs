#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STATES = Object.freeze(['onboarding','home','projects','skills','settings','workroom','control-plane','mission-proofline','review-runtime','browser']);
const WIDTHS = Object.freeze([1440, 1180, 980, 640]);
const RISK_DIMENSIONS = Object.freeze({
  themes: Object.freeze(['light', 'nocturne']),
  locales: Object.freeze(['en', 'vi']),
  modes: Object.freeze(['keyboard-focus', 'reduced-motion', 'forced-colors', 'blocked']),
});

export async function captureUiV3States({ root = process.cwd(), write = true, outputPath = path.join(root, 'docs/ui-v3/visual-state-manifest.json') } = {}) {
  const captures = STATES.flatMap((state) => WIDTHS.map((width) => Object.freeze({ state, width, fixture: `source://${state}/${width}`, screenshotSha256: null, status: 'source-fixture-only' })));
  const report = Object.freeze({
    schema: 'nolane.ui.visual-state-manifest.v2',
    states: STATES,
    widths: WIDTHS,
    riskDimensions: RISK_DIMENSIONS,
    captures: Object.freeze(captures),
    sourceFixturesComplete: captures.length === STATES.length * WIDTHS.length,
    externalScreenshotCertified: false,
    nonClaim: 'This manifest describes required source/runtime coverage only. PASS requires a real exact-revision Chromium/Electron receipt and explicit evidence binding.',
  });
  if (write) { await mkdir(path.dirname(outputPath), { recursive: true }); await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`); }
  return report;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) captureUiV3States({}).then((value) => console.log(JSON.stringify(value))).catch((error) => { console.error(error.stack ?? error); process.exitCode = 1; });
