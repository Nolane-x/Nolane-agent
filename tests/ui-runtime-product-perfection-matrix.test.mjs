import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const EXACT_SHA = 'a'.repeat(40);
const capture = (id, runtimeAssertions = {}, runtimeMetadata = {}) => ({
  id,
  route: '/',
  viewport: { width: id.includes('compact') ? 640 : 1440, height: 1000, deviceScaleFactor: 1 },
  runtimeAssertions,
  runtimeMetadata: {
    theme: 'light',
    locale: 'en',
    experience: 'workspace',
    activeElement: null,
    scroll: { windowX: 0, windowY: 0 },
    overflow: { horizontal: 'PASS' },
    axe: { seriousCritical: 'PASS' },
    semanticSignature: 'semantic-home',
    ...runtimeMetadata,
  },
});

test('Task 10 canonical visual authority declares risk-driven responsive/theme/locale/focus/motion states and exact revision metadata', async () => {
  const [capturer, manifest, workflow, generator] = await Promise.all([
    readFile('scripts/capture-ui-runtime-visual.mjs', 'utf8'),
    readFile('scripts/capture-ui-v3-states.mjs', 'utf8'),
    readFile('.github/workflows/ui-runtime-visual.yml', 'utf8'),
    readFile('scripts/generate-product-perfection-matrix.mjs', 'utf8'),
  ]);

  for (const state of [
    'home-keyboard-focus',
    'home-reduced-motion',
    'home-forced-colors',
    'projects-nocturne',
    'skills-nocturne',
    'settings-nocturne',
    'settings-model-catalog-vi',
    'settings-vi-compact',
    'workroom-nocturne',
    'control-plane-nocturne',
    'mission-proofline-focus',
    'mission-proofline-nocturne',
    'review-runtime',
    'review-runtime-compact',
    'browser-blocked',
    'browser-nocturne',
  ]) assert.match(capturer, new RegExp(`id: '${state}'`), `missing canonical state ${state}`);

  assert.match(capturer, /\.\.\.\(state\.contextOptions \?\? \{\}\)/);
  assert.match(capturer, /async function applyStatePreferences/);
  assert.match(capturer, /async function captureRuntimeMetadata/);
  for (const key of ['experience', 'theme', 'locale', 'activeElement', 'scroll', 'overflow', 'axe', 'semanticSignature']) {
    assert.match(capturer, new RegExp(`${key}:`), `runtime metadata missing ${key}`);
  }
  assert.match(capturer, /reviewSha256Match: 'PASS'/);
  assert.match(capturer, /pollingFocus: 'PASS'/);
  assert.match(capturer, /providerCatalogClipping: 'PASS'/);
  assert.match(capturer, /canonicalProviderNames: 'PASS'/);
  assert.match(capturer, /vietnameseResponsive: 'PASS'/);

  assert.match(manifest, /WIDTHS = Object\.freeze\(\[1440, 1180, 980, 640\]\)/);
  assert.match(manifest, /themes: Object\.freeze\(\['light', 'nocturne'\]\)/);
  assert.match(manifest, /locales: Object\.freeze\(\['en', 'vi'\]\)/);
  assert.match(manifest, /modes: Object\.freeze\(\['keyboard-focus', 'reduced-motion', 'forced-colors', 'blocked'\]\)/);

  assert.match(workflow, /NOLANE_UI_EVIDENCE_REVISION/);
  assert.match(workflow, /github\.event\.pull_request\.head\.sha \|\| github\.sha/);
  assert.match(workflow, /bind-product-perfection-runtime-evidence\.mjs/);
  assert.match(workflow, /product-perfection-runtime-observations\.json/);
  assert.match(workflow, /home-keyboard-focus/);
  assert.match(workflow, /home-reduced-motion/);
  assert.match(workflow, /home-forced-colors/);
  assert.match(workflow, /settings-vi-compact/);
  assert.match(workflow, /review-runtime/);
  assert.match(workflow, /browser-blocked/);

  assert.match(generator, /product-perfection-observations\.json/);
  assert.doesNotMatch(generator, /observations:\s*\[\]/);
});

test('Task 10 runtime binder fails closed and only promotes explicitly observed PFX ids', async () => {
  const { buildRuntimePerfectionObservations } = await import('../scripts/bind-product-perfection-runtime-evidence.mjs');
  const visualReceipt = {
    captures: [
      capture('home', {}, { semanticSignature: 'semantic-home' }),
      capture('home-keyboard-focus', { focusVisible: 'PASS' }),
      capture('home-reduced-motion', { reducedMotion: 'PASS' }, { semanticSignature: 'semantic-home' }),
      capture('home-forced-colors', { forcedColors: 'PASS', focusVisible: 'PASS' }),
      capture('settings-model-catalog', { providerCatalogClipping: 'PASS', canonicalProviderNames: 'PASS' }),
      capture('settings-model-catalog-vi', { providerCatalogClipping: 'PASS', canonicalProviderNames: 'PASS' }, { locale: 'vi' }),
      capture('settings-vi-compact', { vietnameseResponsive: 'PASS' }, { locale: 'vi', overflow: { horizontal: 'PASS' } }),
      capture('mission-proofline-focus', { pollingFocus: 'PASS' }),
    ],
  };
  const responsiveReceipt = {
    captures: [
      capture('responsive-settings-640'),
      capture('responsive-settings-980'),
      capture('responsive-settings-1180'),
      capture('responsive-settings-1440'),
    ],
  };
  const observations = buildRuntimePerfectionObservations({
    visualReceipt,
    responsiveReceipt,
    revision: EXACT_SHA,
    runId: '12345',
    artifactName: 'ui-runtime-visual',
  });
  const byId = new Map(observations.map((item) => [item.id, item]));
  assert.deepEqual([...byId.keys()].sort(), [
    'PFX-CONTENT-009',
    'PFX-CONTENT-012',
    'PFX-KEY-003',
    'PFX-KEY-017',
    'PFX-MOTION-002',
    'PFX-RES-017',
    'PFX-TYPE-007',
  ]);
  for (const item of observations) {
    assert.equal(item.status, 'PASS');
    assert.equal(item.revision, EXACT_SHA);
    assert.ok(item.evidence.length >= 1);
    assert.ok(item.evidence.every((entry) => entry.ref.includes('run:12345')));
  }
  assert.throws(() => buildRuntimePerfectionObservations({
    visualReceipt: { captures: visualReceipt.captures.filter((item) => item.id !== 'settings-vi-compact') },
    responsiveReceipt,
    revision: EXACT_SHA,
    runId: '12345',
    artifactName: 'ui-runtime-visual',
  }), /settings-vi-compact/);
});
