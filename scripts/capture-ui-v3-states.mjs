#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const STATES = Object.freeze(['onboarding','home','mission-running','mission-planning','approval','permission','failure','review','workroom','control-plane-overview','control-plane-runtime','control-plane-evidence']);
const WIDTHS = Object.freeze([1440, 1180, 900]);
export async function captureUiV3States({ root = process.cwd(), write = true, outputPath = path.join(root, 'docs/ui-v3/visual-state-manifest.json') } = {}) {
  const captures = STATES.flatMap((state) => WIDTHS.map((width) => Object.freeze({ state, width, fixture: `source://${state}/${width}`, screenshotSha256: null, status: 'source-fixture-only' })));
  const report = Object.freeze({ schema: 'nolane.ui.visual-state-manifest.v1', states: STATES, widths: WIDTHS, captures: Object.freeze(captures), sourceFixturesComplete: captures.length === STATES.length * WIDTHS.length, externalScreenshotCertified: false, nonClaim: 'No screenshot, visual regression, or pixel-diff claim is made without a real Chromium/Electron capture receipt.' });
  if (write) { await mkdir(path.dirname(outputPath), { recursive: true }); await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`); }
  return report;
}
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) captureUiV3States({}).then((value) => console.log(JSON.stringify(value))).catch((error) => { console.error(error.stack ?? error); process.exitCode = 1; });
