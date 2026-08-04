import test from 'node:test';
import assert from 'node:assert/strict';
import { MissionResourceFabric } from '../src/runtime/mission-resource-fabric.mjs';

const governor = { snapshot: () => ({ state: 'normal', policy: { maxActiveAgents: 2 } }) };
const driver = { async sampleTree() { return { cpuTimeMs: 1, rssBytes: 2, processCount: 1, pids: [123] }; } };
const canary = { snapshot: () => Object.freeze({ schema: 'forge.harness-canary-controller-snapshot.v1', configs: [], metrics: [], journal: [], receiptSha256: 'a'.repeat(64) }) };

test('MissionResourceFabric owns one bounded lifecycle for resources, sessions, journal, canary, journeys and hosted work', async () => {
  const fabric = new MissionResourceFabric({ governor, processDriver: driver, canary, projectRootResolver: async () => process.cwd() });
  assert.ok(fabric.processLedger);
  assert.ok(fabric.sessionHost);
  assert.ok(fabric.journal);
  assert.equal(fabric.canary, canary);
  assert.ok(fabric.journeys);
  assert.ok(fabric.hostedLifecycle);
  const view = fabric.publicView();
  assert.equal(view.schema, 'forge.mission-resource-fabric.v1');
  assert.equal(view.resources.schema, 'forge.mission-process-ledger-snapshot.v1');
  assert.equal(view.sessions.schema, 'forge.provider-session-host-snapshot.v1');
  assert.equal(view.intelligence.schema, 'forge.incremental-intelligence-journal-snapshot.v1');
  assert.equal(view.journeys.schema, 'forge.browser-journey-recorder-snapshot.v1');
  assert.equal(view.hosted.schema, 'forge.hosted-lifecycle-snapshot.v1');
  assert.match(view.receiptSha256, /^[a-f0-9]{64}$/);

  const pressure = await fabric.onGovernorSnapshot({ state: 'pressure' });
  assert.equal(pressure.state, 'pressure');
  const closed = await fabric.close();
  assert.equal(closed.closed, true);
  await assert.rejects(() => fabric.onGovernorSnapshot({ state: 'normal' }), /closed/i);
});

test('MissionResourceFabric exposes bounded decision-efficiency observations', async () => {
  const fabric = new MissionResourceFabric({ governor, processDriver: driver, canary, projectRootResolver: async () => process.cwd() });
  const recorded = fabric.recordDecisionEfficiency({
    taskId: 'task-1', providerId: 'codex', taskKind: 'debug',
    criterionSnapshot: { totalCriteriaWeight: 4, verifiedCriteriaScore: 4, receiptSha256: 'a'.repeat(64) },
    inputTokens: 1000, outputTokens: 1000, rssMbSeconds: 600, changedLines: 5, changedFiles: 1, semanticFootprint: 2, observedAtMs: 100,
  });
  assert.equal(recorded.verifiedValue, 4);
  const view = fabric.publicView();
  assert.equal(view.decisionEfficiency.summary.samples, 1);
  assert.equal(view.decisionEfficiency.entries[0].providerId, 'codex');
  await fabric.close();
});
