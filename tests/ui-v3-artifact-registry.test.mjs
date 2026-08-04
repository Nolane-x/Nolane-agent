import test from 'node:test';
import assert from 'node:assert/strict';
import { createArtifactRegistry, createArtifactDockController } from '../ui-v3/views/mission/artifact-registry.mjs';
import { createPlanArtifactRenderer } from '../ui-v3/views/mission/artifacts/plan-artifact.mjs';
import { createTestsArtifactRenderer } from '../ui-v3/views/mission/artifacts/tests-artifact.mjs';
import { createPreviewArtifactRenderer } from '../ui-v3/views/mission/artifacts/preview-artifact.mjs';

test('artifact registry loads only requested renderer and tears it down on switch', async () => {
  const events = [];
  const registry = createArtifactRegistry();
  registry.register({ kind: 'plan', label: 'Plan', priority: 20, loadRenderer: async () => ({ createRenderer: () => ({ render: (value) => events.push(['plan-render', value.id]), destroy: () => events.push(['plan-destroy']) }) }) });
  registry.register({ kind: 'tests', label: 'Tests', priority: 40, loadRenderer: async () => ({ createRenderer: () => ({ render: (value) => events.push(['tests-render', value.id]), destroy: () => events.push(['tests-destroy']) }) }) });
  const controller = createArtifactDockController({ missionId: 'm1', registry });
  controller.setArtifacts([{ id: 'p1', type: 'plan' }, { id: 't1', type: 'tests' }]);
  await controller.open('plan');
  assert.deepEqual(events, [['plan-render', 'p1']]);
  await controller.open('tests');
  assert.deepEqual(events, [['plan-render', 'p1'], ['plan-destroy'], ['tests-render', 't1']]);
  await controller.destroy();
  assert.deepEqual(events.at(-1), ['tests-destroy']);
  assert.deepEqual(controller.snapshot().loadedKinds, ['plan', 'tests']);
});

test('artifact controller exposes only artifact-backed kinds in registry priority order', () => {
  const registry = createArtifactRegistry();
  registry.register({ kind: 'tests', label: 'Tests', priority: 30, loadRenderer: async () => ({}) });
  registry.register({ kind: 'plan', label: 'Plan', priority: 20, loadRenderer: async () => ({}) });
  registry.register({ kind: 'preview', label: 'Preview', priority: 10, loadRenderer: async () => ({}) });
  const controller = createArtifactDockController({ missionId: 'm1', registry });
  controller.setArtifacts([{ id: 't1', type: 'tests' }, { id: 'p1', type: 'plan' }]);
  assert.deepEqual(controller.snapshot().tabs.map((item) => item.kind), ['plan', 'tests']);
  assert.throws(() => controller.open('preview'), /unavailable/i);
});

test('built-in artifact renderers fail closed on incomplete evidence', () => {
  const plan = createPlanArtifactRenderer();
  assert.throws(() => plan.render({ id: 'p1', steps: [] }), /outcome/i);
  const tests = createTestsArtifactRenderer();
  assert.throws(() => tests.render({ id: 't1', passed: 1, total: 1 }), /receipt/i);
  const preview = createPreviewArtifactRenderer();
  assert.throws(() => preview.render({ id: 'v1', status: 'ready' }), /snapshot/i);
  const rendered = preview.render({ id: 'v1', status: 'ready', snapshotSha256: 'a'.repeat(64), url: 'http://127.0.0.1:3210' });
  assert.equal(rendered.status, 'ready');
  preview.suspend();
  assert.equal(preview.snapshot().polling, false);
});
