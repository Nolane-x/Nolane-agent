import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import {
  ProductArtifactRecorder,
  VisualRegressionOracle,
  JourneyContextReuse,
  AccessibilityAcceptance,
  ArtifactPlayback,
  FailureInjectionLab,
  UnifiedWorkSurface,
  VsCodeEvidenceBridge,
} from '../src/frontier-completion/product-security-experience-runtime.mjs';
import { createLocalFrontierWorkSurface } from '../ui/local-frontier-work-surface.js';

const sha = (value) => createHash('sha256').update(value).digest('hex');
const approval = { actor: 'human-reviewer', approved: true, receiptSha256: sha('approved-baseline') };

test('product artifact recorder hashes before-after screenshots and video frames and exports reviewer demo', () => {
  const recorder = new ProductArtifactRecorder();
  const journey = recorder.record({ journeyId: 'j1', before: Buffer.from('before-png'), after: Buffer.from('after-png'), frames: [Buffer.from('f1'), Buffer.from('f2')] });
  assert.match(journey.before.sha256, /^[a-f0-9]{64}$/);
  assert.notEqual(journey.before.sha256, journey.after.sha256);
  assert.equal(journey.frames.length, 2);
  const demo = recorder.exportDemo('j1');
  assert.equal(demo.artifacts.length, 4);
  assert.match(demo.receiptSha256, /^[a-f0-9]{64}$/);
});

test('visual regression applies tolerance and only reviewed ignore regions, requiring human baseline for critical oracle', () => {
  const oracle = new VisualRegressionOracle();
  const baseline = oracle.approveBaseline({ id: 'critical-home', pixels: [0, 10, 20, 30], critical: true, approval });
  const pass = oracle.compare({ baselineId: baseline.id, actualPixels: [0, 12, 99, 31], tolerance: 3, ignoreRegions: [{ indexes: [2], reviewReceiptSha256: sha('ignore-review') }] });
  assert.equal(pass.status, 'pass');
  assert.equal(pass.differentPixels, 0);
  assert.throws(() => oracle.approveBaseline({ id: 'bad', pixels: [1], critical: true }), /human-approved/i);
  assert.throws(() => oracle.compare({ baselineId: baseline.id, actualPixels: [0, 12, 99, 31], tolerance: 3, ignoreRegions: [{ indexes: [2] }] }), /review/i);
});

test('journey context reuse requires a reset receipt and accessibility criteria are feature-bound', async () => {
  let created = 0; let reset = 0;
  const reuse = new JourneyContextReuse({ create: async () => ({ id: `ctx-${++created}` }), reset: async () => ({ status: 'reset', receiptSha256: sha(`reset-${++reset}`) }) });
  const first = await reuse.acquire({ missionId: 'm1', journeyId: 'login' });
  const second = await reuse.acquire({ missionId: 'm1', journeyId: 'settings' });
  assert.equal(first.context.id, second.context.id);
  assert.match(second.resetReceiptSha256, /^[a-f0-9]{64}$/);

  const a11y = new AccessibilityAcceptance();
  const report = a11y.evaluate({ featureId: 'settings', criteria: ['keyboard', 'label', 'contrast'], findings: { keyboard: true, label: true, contrast: true } });
  assert.equal(report.status, 'pass');
  assert.equal(report.criteria.length, 3);
});

test('artifact playback can rewind to an immutable checkpoint', () => {
  const playback = new ArtifactPlayback();
  playback.append('j1', { checkpointId: 'c1', atMs: 10, artifactSha256: sha('a1'), state: { page: 'home' } });
  playback.append('j1', { checkpointId: 'c2', atMs: 20, artifactSha256: sha('a2'), state: { page: 'settings' } });
  assert.equal(playback.timeline('j1').length, 2);
  assert.deepEqual(playback.rewind('j1', 'c1').state, { page: 'home' });
});

test('failure injection lab covers network provider resource storage and escape scenarios with deterministic receipts', async () => {
  const lab = new FailureInjectionLab();
  const scenarios = ['network-loss', 'timeout', 'dns-failure', 'provider-overload', 'out-of-memory', 'process-death', 'orphan-child', 'fd-exhaustion', 'db-lock', 'disk-full', 'file-changed-during-transaction', 'environment-leakage', 'socket-escape', 'credential-escape'];
  for (const scenario of scenarios) {
    const report = await lab.run(scenario, async (fault) => ({ observed: fault.code, contained: true }));
    assert.equal(report.status, 'contained', scenario);
    assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
  }
  assert.throws(() => lab.definition('unknown'), /unsupported/i);
});

test('unified work surface exposes six views command palette role projections and dependency-aware cross-repo chain', () => {
  const surface = new UnifiedWorkSurface({ state: { missionId: 'm1', revision: 7 } });
  assert.deepEqual(surface.views(), ['browser', 'code', 'diff', 'terminal', 'test', 'timeline']);
  surface.registerCommand({ id: 'open-device-doctor', center: 'device-doctor' });
  assert.equal(surface.executeCommand('open-device-doctor').center, 'device-doctor');
  const roles = surface.roleViews();
  assert.equal(roles.builder.stateSha256, roles.reviewer.stateSha256);
  assert.equal(roles.reviewer.stateSha256, roles.operator.stateSha256);
  const chain = surface.crossRepositoryChain({ repositories: [{ id: 'api', dependsOn: ['core'] }, { id: 'web', dependsOn: ['api'] }, { id: 'core', dependsOn: [] }] });
  assert.deepEqual(chain.order, ['core', 'api', 'web']);
});

test('work surface virtualizes large data, reduces effects under pressure and reports device/performance budgets honestly', () => {
  const surface = new UnifiedWorkSurface({ state: { missionId: 'm2' } });
  const rows = Array.from({ length: 10_000 }, (_, index) => ({ id: index }));
  assert.deepEqual(surface.virtualize(rows, { start: 100, count: 5 }).items.map((x) => x.id), [100, 101, 102, 103, 104]);
  assert.deepEqual(surface.effects({ pressure: 'high', prefersReducedMotion: false }), { animation: false, blur: false, transitionsMs: 0 });
  assert.deepEqual(surface.effects({ pressure: 'normal', prefersReducedMotion: true }), { animation: false, blur: false, transitionsMs: 0 });
  const doctor = surface.deviceDoctor({ availableRamMb: 4096, cpuCores: 4, subsystem: 'semantic-index' });
  assert.equal(doctor.recommendation, 'bounded');
  const perf = surface.performance({ startupMs: 800, inputLatencyMs: 30, scrollFrameMs: 12, panelSwitchMs: 80 }, { startupMs: 1000, inputLatencyMs: 50, scrollFrameMs: 16.7, panelSwitchMs: 100 });
  assert.equal(perf.status, 'pass');
  assert.equal(surface.designHonesty().hidesMissingStateWithEffects, false);
});

test('VS Code bridge carries inline diff diagnostics symbols tests and mission state under one revision receipt', () => {
  const bridge = new VsCodeEvidenceBridge();
  const state = bridge.publish({ revision: 8, inlineDiff: [{ file: 'a.js', hunks: 1 }], diagnostics: [{ severity: 'error', file: 'a.js' }], symbols: ['A'], tests: [{ id: 't1', status: 'pass' }], missionState: { id: 'm1', phase: 'verify' } });
  assert.equal(state.revision, 8);
  assert.equal(state.inlineDiff.length, 1);
  assert.equal(state.diagnostics.length, 1);
  assert.match(state.receiptSha256, /^[a-f0-9]{64}$/);
});

test('browser work surface renderer exposes all views roles palette and truthful missing state', () => {
  const model = createLocalFrontierWorkSurface({ missionId: 'm1', missing: ['browser'], pressure: 'normal' });
  assert.deepEqual(model.views.map((x) => x.id), ['code', 'diff', 'terminal', 'browser', 'test', 'timeline']);
  assert.deepEqual(model.roles, ['builder', 'reviewer', 'operator']);
  assert.equal(model.views.find((x) => x.id === 'browser').state, 'missing');
  assert.equal(model.effects.blur, false);
});
