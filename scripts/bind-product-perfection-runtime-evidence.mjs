#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EXACT_SHA = /^[0-9a-f]{40}$/;

function required(value, name) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new TypeError(`${name} is required`);
  return normalized;
}

function requireCapture(receipt, id) {
  const capture = receipt?.captures?.find((item) => item?.id === id);
  if (!capture) throw new Error(`runtime evidence requires state ${id}`);
  return capture;
}

function requirePass(capture, key) {
  if (capture?.runtimeAssertions?.[key] !== 'PASS') {
    throw new Error(`${capture?.id ?? '<unknown>'} requires runtime assertion ${key}=PASS`);
  }
}

function requireMetadataPass(capture, group, key) {
  if (capture?.runtimeMetadata?.[group]?.[key] !== 'PASS') {
    throw new Error(`${capture?.id ?? '<unknown>'} requires runtime metadata ${group}.${key}=PASS`);
  }
}

function evidence(runId, artifactName, stateId, classes) {
  const ref = `run:${runId}/artifact:${artifactName}/state:${stateId}`;
  return classes.map((evidenceClass) => Object.freeze({ class: evidenceClass, ref }));
}

export function buildRuntimePerfectionObservations({ visualReceipt, responsiveReceipt, revision, runId, artifactName = 'ui-runtime-visual' } = {}) {
  const exactRevision = required(revision, 'revision');
  if (!EXACT_SHA.test(exactRevision)) throw new Error('revision must be an exact 40-character Git SHA');
  const exactRunId = required(runId, 'runId');
  const artifact = required(artifactName, 'artifactName');

  const home = requireCapture(visualReceipt, 'home');
  const keyboard = requireCapture(visualReceipt, 'home-keyboard-focus');
  const reduced = requireCapture(visualReceipt, 'home-reduced-motion');
  const forced = requireCapture(visualReceipt, 'home-forced-colors');
  const settingsModel = requireCapture(visualReceipt, 'settings-model-catalog');
  const settingsModelVi = requireCapture(visualReceipt, 'settings-model-catalog-vi');
  const settingsViCompact = requireCapture(visualReceipt, 'settings-vi-compact');
  const prooflineFocus = requireCapture(visualReceipt, 'mission-proofline-focus');

  requirePass(keyboard, 'focusVisible');
  requirePass(reduced, 'reducedMotion');
  requirePass(forced, 'forcedColors');
  requirePass(forced, 'focusVisible');
  requirePass(settingsModel, 'providerCatalogClipping');
  requirePass(settingsModel, 'canonicalProviderNames');
  requirePass(settingsModelVi, 'providerCatalogClipping');
  requirePass(settingsModelVi, 'canonicalProviderNames');
  requirePass(settingsViCompact, 'vietnameseResponsive');
  requirePass(prooflineFocus, 'pollingFocus');
  requireMetadataPass(settingsViCompact, 'overflow', 'horizontal');

  const homeSemantic = required(home?.runtimeMetadata?.semanticSignature, 'home semanticSignature');
  const reducedSemantic = required(reduced?.runtimeMetadata?.semanticSignature, 'home-reduced-motion semanticSignature');
  if (homeSemantic !== reducedSemantic) throw new Error('reduced-motion capture must preserve the Home semantic signature');
  if (settingsViCompact?.runtimeMetadata?.locale !== 'vi') throw new Error('settings-vi-compact must report locale=vi');

  const responsiveIds = new Set((responsiveReceipt?.captures ?? []).map((item) => item?.id));
  for (const width of [640, 980, 1180, 1440]) {
    const id = `responsive-settings-${width}`;
    if (!responsiveIds.has(id)) throw new Error(`responsive evidence requires state ${id}`);
  }

  return Object.freeze([
    Object.freeze({
      id: 'PFX-TYPE-007', status: 'PASS', revision: exactRevision,
      evidence: Object.freeze([
        ...evidence(exactRunId, artifact, settingsModel.id, ['DOM', 'VIS']),
        ...evidence(exactRunId, artifact, settingsModelVi.id, ['DOM', 'VIS']),
      ]),
      notes: 'Provider/model catalog clipping checks passed in English and Vietnamese runtime states.',
    }),
    Object.freeze({
      id: 'PFX-KEY-003', status: 'PASS', revision: exactRevision,
      evidence: Object.freeze(evidence(exactRunId, artifact, keyboard.id, ['DOM', 'VIS', 'A11Y'])),
      notes: 'Focused primary Home action remained visible inside the viewport with an explicit focus indicator.',
    }),
    Object.freeze({
      id: 'PFX-KEY-017', status: 'PASS', revision: exactRevision,
      evidence: Object.freeze(evidence(exactRunId, artifact, prooflineFocus.id, ['DOM', 'VIS'])),
      notes: 'Proofline Activity polling preserved the focused control through the asynchronous rerender interval.',
    }),
    Object.freeze({
      id: 'PFX-MOTION-002', status: 'PASS', revision: exactRevision,
      evidence: Object.freeze([
        ...evidence(exactRunId, artifact, home.id, ['DOM', 'VIS']),
        ...evidence(exactRunId, artifact, reduced.id, ['DOM', 'VIS', 'A11Y']),
      ]),
      notes: 'Reduced-motion runtime state preserved the same stable Home semantic signature.',
    }),
    Object.freeze({
      id: 'PFX-RES-017', status: 'PASS', revision: exactRevision,
      evidence: Object.freeze(evidence(exactRunId, artifact, forced.id, ['DOM', 'VIS', 'A11Y'])),
      notes: 'Forced-colors runtime retained a visible focus indicator on the primary Home action.',
    }),
    Object.freeze({
      id: 'PFX-CONTENT-009', status: 'PASS', revision: exactRevision,
      evidence: Object.freeze(evidence(exactRunId, artifact, settingsModelVi.id, ['DOM', 'VIS'])),
      notes: 'Vietnamese Settings runtime kept canonical provider/model names unchanged while localizing surrounding UI.',
    }),
    Object.freeze({
      id: 'PFX-CONTENT-012', status: 'PASS', revision: exactRevision,
      evidence: Object.freeze([
        ...evidence(exactRunId, artifact, settingsViCompact.id, ['DOM', 'VIS']),
        ...[640, 980, 1180, 1440].flatMap((width) => evidence(exactRunId, artifact, `responsive-settings-${width}`, ['VIS'])),
      ]),
      notes: 'Vietnamese Settings copy is included in compact runtime capture and the canonical responsive Settings matrix covers 640/980/1180/1440.',
    }),
  ]);
}

async function main() {
  const visualPath = path.resolve(required(process.env.NOLANE_UI_VISUAL_RECEIPT, 'NOLANE_UI_VISUAL_RECEIPT'));
  const responsivePath = path.resolve(required(process.env.NOLANE_UI_RESPONSIVE_RECEIPT, 'NOLANE_UI_RESPONSIVE_RECEIPT'));
  const outputPath = path.resolve(process.env.NOLANE_PRODUCT_PERFECTION_OBSERVATIONS_OUTPUT || 'requirements/product-perfection-observations.json');
  const visualReceipt = JSON.parse(await readFile(visualPath, 'utf8'));
  const responsiveReceipt = JSON.parse(await readFile(responsivePath, 'utf8'));
  const revision = required(process.env.NOLANE_UI_EVIDENCE_REVISION || process.env.GITHUB_SHA, 'NOLANE_UI_EVIDENCE_REVISION');
  const runId = required(process.env.GITHUB_RUN_ID, 'GITHUB_RUN_ID');
  const artifactName = process.env.NOLANE_UI_EVIDENCE_ARTIFACT || 'ui-runtime-visual';
  const items = buildRuntimePerfectionObservations({ visualReceipt, responsiveReceipt, revision, runId, artifactName });
  const payload = Object.freeze({ schema: 'nolane.product-perfection.observations.v1', revision, runId, artifactName, items });
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ observations: items.length, revision, runId, outputPath }));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().catch((error) => { console.error(error.stack ?? error); process.exitCode = 1; });
