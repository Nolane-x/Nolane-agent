import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReviewQueue } from '../ui-v3/views/review-queue/review-queue.mjs';
import { buildProjectViewModel } from '../ui-v3/views/projects/project-view.mjs';
import { createSettingsModel } from '../ui-v3/views/settings/settings-view.mjs';

test('Review Queue is an action inbox ordered by urgency and wait time', () => {
  const queue = buildReviewQueue([
    { id: 'ready', kind: 'ready-to-review', waitingSince: 30 },
    { id: 'permission', kind: 'permission', waitingSince: 20 },
    { id: 'failed', kind: 'failed-after-retry', waitingSince: 10 },
  ]);
  assert.deepEqual(queue.map((item) => item.id), ['permission', 'failed', 'ready']);
  assert.ok(queue.every((item) => item.primaryAction));
});

test('Projects view exposes trust and mission summaries without loading intelligence graph', () => {
  const value = buildProjectViewModel({ id: 'p1', path: '/repo', trust: 'trusted', missions: [{ status: 'running' }, { status: 'completed' }], graph: { nodes: [1] } });
  assert.equal(value.activeMissions, 1);
  assert.equal(value.completedMissions, 1);
  assert.equal('graph' in value, false);
  assert.equal(value.openIntelligenceRoute, '/control-plane/intelligence/repository?project=p1');
});

test('Settings validates basic performance profiles and keeps advanced routing out of level one', () => {
  const model = createSettingsModel();
  model.update({ appearance: 'dark', performanceProfile: 'lite', defaultIntent: 'build' });
  assert.equal(model.snapshot().performanceProfile, 'lite');
  assert.throws(() => model.update({ performanceProfile: 'extreme' }), /profile/i);
  assert.equal('providerFallbackChain' in model.snapshot(), false);
});
