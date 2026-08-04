import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { applyRuntimePerformancePolicy } from '../ui/runtime-performance-policy.js';

function fakeRoot() {
  const classes = new Set();
  return {
    dataset: {},
    classList: {
      add: (...items) => items.forEach((item) => classes.add(item)),
      remove: (...items) => items.forEach((item) => classes.delete(item)),
      contains: (item) => classes.has(item),
      values: () => [...classes],
    },
  };
}

function runtime({ profile = 'balanced', state = 'normal', reducedEffects = false, browser = 1 } = {}) {
  return {
    profile: { resolved: profile, reducedEffects },
    resources: {
      state,
      policy: { maxBrowserSessions: browser, maxEditorModels: profile === 'lite' ? 4 : 8 },
    },
  };
}

test('lite profile enables reduced effects and a 30 FPS rendering budget', () => {
  const root = fakeRoot();
  const policy = applyRuntimePerformancePolicy(runtime({ profile: 'lite' }), { root, prefersReducedMotion: false, deviceMemoryGiB: 8 });
  assert.equal(policy.reducedEffects, true);
  assert.equal(policy.terminalFrameIntervalMs, 33);
  assert.equal(policy.liveGraphAnimations, false);
  assert.equal(root.dataset.forgeProfile, 'lite');
  assert.equal(root.dataset.forgeResourceState, 'normal');
  assert.equal(root.classList.contains('forge-profile-lite'), true);
  assert.equal(root.classList.contains('forge-reduced-effects'), true);
});

test('balanced normal runtime keeps full effects unless the user requests reduced motion', () => {
  const root = fakeRoot();
  const policy = applyRuntimePerformancePolicy(runtime(), { root, prefersReducedMotion: false, deviceMemoryGiB: 16 });
  assert.equal(policy.reducedEffects, false);
  assert.equal(policy.terminalFrameIntervalMs, 16);
  assert.equal(policy.liveGraphAnimations, true);
  assert.equal(root.classList.contains('forge-reduced-effects'), false);
});

test('pressure and emergency force reduced effects and suspend optional visuals', () => {
  for (const state of ['pressure', 'brownout', 'emergency']) {
    const root = fakeRoot();
    const policy = applyRuntimePerformancePolicy(runtime({ state }), { root, prefersReducedMotion: false, deviceMemoryGiB: 32 });
    assert.equal(policy.reducedEffects, true);
    assert.equal(policy.terminalFrameIntervalMs, 33);
    assert.equal(policy.suspendOptionalVisuals, true);
    assert.equal(root.classList.contains(`forge-resource-${state}`), true);
  }
});

test('reapplying the policy removes stale profile and resource classes', () => {
  const root = fakeRoot();
  applyRuntimePerformancePolicy(runtime({ profile: 'lite', state: 'emergency' }), { root });
  applyRuntimePerformancePolicy(runtime({ profile: 'performance', state: 'normal' }), { root, prefersReducedMotion: false, deviceMemoryGiB: 32 });
  assert.equal(root.classList.contains('forge-profile-lite'), false);
  assert.equal(root.classList.contains('forge-resource-emergency'), false);
  assert.equal(root.classList.contains('forge-profile-performance'), true);
});

test('application and Workroom apply the shared runtime policy and load reduced-effects CSS', async () => {
  const [app, workroom, html, css] = await Promise.all([
    readFile(new URL('../ui/app.js', import.meta.url), 'utf8'),
    readFile(new URL('../ui/workroom.js', import.meta.url), 'utf8'),
    readFile(new URL('../ui/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../ui/runtime-performance.css', import.meta.url), 'utf8').catch(() => ''),
  ]);
  assert.match(app, /applyRuntimePerformancePolicy/);
  assert.match(app, /api\('\/api\/runtime'\)/);
  assert.match(workroom, /applyRuntimePerformancePolicy\(runtime/);
  assert.match(html, /runtime-performance\.css/);
  assert.match(css, /\.forge-reduced-effects/);
  assert.match(css, /backdrop-filter\s*:\s*none\s*!important/);
  assert.match(css, /animation\s*:\s*none\s*!important/);
});
