import test from 'node:test';
import assert from 'node:assert/strict';
import { createControlPlaneModel } from '../ui-v3/control-plane/control-plane-shell.mjs';
import { buildOverviewView } from '../ui-v3/control-plane/overview/overview-view.mjs';
import { layoutRepositoryGraph } from '../ui-v3/workers/graph-worker.mjs';
import { createSearchWorkerJob } from '../ui-v3/workers/search-worker.mjs';
import { buildAutonomyView } from '../ui-v3/control-plane/domains/autonomy.mjs';
import { buildExtensionsView } from '../ui-v3/control-plane/domains/extensions.mjs';
import { buildReleaseView } from '../ui-v3/control-plane/domains/release.mjs';

test('Control Plane isolates route loader failures and preserves mission context', async () => {
  const model = createControlPlaneModel({ missionContext: { missionId: 'm1', returnPath: '/missions/m1' }, loader: async (domain) => { if (domain === 'runtime') throw new Error('runtime exploded'); return { domain }; } });
  const failed = await model.navigateSafe('/control-plane/runtime');
  assert.equal(failed.status, 'error');
  assert.match(failed.message, /runtime exploded/);
  const healthy = await model.navigateSafe('/control-plane/overview');
  assert.equal(healthy.status, 'ready');
  assert.equal(model.snapshot().missionContext.missionId, 'm1');
});

test('overview reports actionable health without decorative chart requirements', () => {
  const value = buildOverviewView({ health: 'degraded', activeMissions: 2, pendingApprovals: 1, evidenceGaps: 3, providerFailures: 1 });
  assert.equal(value.actionRequired, true);
  assert.deepEqual(value.actions.map((item) => item.kind), ['approval', 'evidence-gap', 'provider']);
  assert.equal(value.decorativeCharts, false);
});

test('graph and search workers are deterministic and cancellable', async () => {
  const graph = layoutRepositoryGraph({ nodes: [{ id: 'b' }, { id: 'a' }], edges: [{ from: 'a', to: 'b' }] });
  assert.deepEqual(graph.nodes.map((item) => item.id), ['a', 'b']);
  assert.equal(graph.animation, 'interaction-only');
  const job = createSearchWorkerJob({ items: [{ id: '1', text: 'alpha beta' }, { id: '2', text: 'gamma' }], query: 'alpha' });
  const result = await job.run();
  assert.deepEqual(result.map((item) => item.id), ['1']);
  job.cancel();
  assert.equal(job.snapshot().cancelled, true);
});

test('autonomy extensions and release routes fail closed on risky promotion', () => {
  const autonomy = buildAutonomyView({ preset: 'build', budgets: { tokens: 1000 }, spawning: { maxAgents: 3 } });
  assert.equal(autonomy.preset, 'build');
  assert.equal(autonomy.requiresApprovalForIrreversible, true);
  const extensions = buildExtensionsView({ plugins: [{ id: 'p1', signed: false, quarantined: true }], providers: [{ id: 'local', connected: true }] });
  assert.equal(extensions.plugins[0].canActivate, false);
  const release = buildReleaseView({ version: '5.0.0-beta.6', signed: false, integrityVerified: true, cleanRoomVerified: true });
  assert.equal(release.canPromote, false);
  assert.deepEqual(release.blockers, ['signature']);
});
