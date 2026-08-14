#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureUiRuntimeVisual } from './capture-ui-runtime-visual.mjs';

const WIDTHS = Object.freeze([640, 900, 1180, 1440, 1600]);
const SURFACES = Object.freeze([
  Object.freeze({ id: 'home', route: '/', selector: '.home-view' }),
  Object.freeze({ id: 'projects', route: '/projects', selector: '.projects-page' }),
  Object.freeze({ id: 'skills', route: '/skills', selector: '.skills-library' }),
  Object.freeze({ id: 'settings', route: '/settings', selector: '.settings-center' }),
  Object.freeze({ id: 'workroom', route: '/workroom', selector: '.workroom-view' }),
  Object.freeze({ id: 'control-plane', route: '/control-plane', selector: '#workspace' }),
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

function responsiveStates() {
  return SURFACES.flatMap((surface) => WIDTHS.map((width) => Object.freeze({
    ...surface,
    id: `responsive-${surface.id}-${width}`,
    viewport: Object.freeze({ width, height: width <= 900 ? 900 : 1000 }),
  })));
}

export async function captureUiResponsiveEvidence({ baseUrl, token, outputDirectory } = {}) {
  const root = path.resolve(required(outputDirectory, 'outputDirectory'), 'responsive');
  const states = responsiveStates();
  await mkdir(root, { recursive: true });
  let result;
  try {
    result = await captureUiRuntimeVisual({
      baseUrl: required(baseUrl, 'baseUrl'),
      token: required(token, 'token'),
      outputDirectory: root,
      states,
    });
  } catch (error) {
    const message = redact(error?.message ?? error);
    const failure = Object.freeze({
      schema: 'nolane.ui.responsive-runtime-failure.v1',
      evidenceClass: 'runtime_candidate',
      certificationState: 'candidate_unverified',
      finalDecision: 'external_gate',
      requirementProjection: Object.freeze({ 'NOL-UI-031': 'external_gate' }),
      message,
    });
    const receiptSha256 = sha256(JSON.stringify(failure));
    await writeFile(path.join(root, 'failure.json'), `${JSON.stringify({ ...failure, receiptSha256 }, null, 2)}\n`);
    throw new Error(message);
  }
  if (result.captures.length !== states.length) {
    throw new Error(`Responsive evidence capture count mismatch: ${result.captures.length}/${states.length}`);
  }

  const payload = Object.freeze({
    schema: 'nolane.ui.responsive-runtime-evidence.v1',
    evidenceClass: 'runtime_candidate',
    certificationState: 'candidate_unverified',
    finalDecision: 'external_gate',
    requirementProjection: Object.freeze({ 'NOL-UI-031': 'external_gate' }),
    widths: WIDTHS,
    surfaces: Object.freeze(SURFACES.map(({ id, route, selector }) => Object.freeze({ id, route, selector }))),
    captures: Object.freeze(result.captures),
    claims: Object.freeze({ responsiveCertified: false }),
  });
  const receiptSha256 = sha256(JSON.stringify(payload));
  await writeFile(path.join(result.output, 'receipt.json'), `${JSON.stringify({ ...payload, receiptSha256 }, null, 2)}\n`);
  return Object.freeze({ output: result.output, captures: result.captures, receiptSha256 });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) captureUiResponsiveEvidence({
  baseUrl: process.env.NOLANE_UI_RUNTIME_URL,
  token: process.env.NOLANE_AGENT_TOKEN,
  outputDirectory: process.env.NOLANE_UI_VISUAL_OUTPUT,
}).then((result) => console.log(JSON.stringify({ captures: result.captures.length, receiptSha256: result.receiptSha256 }))).catch((error) => {
  console.error(error.stack ?? error);
  process.exitCode = 1;
});
