import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { SmallModelFoundationService } from '../src/small-model/foundation-service.mjs';
import { buildCheckpoint6SpecialistDataset, CHECKPOINT_6_SPECIALISTS } from '../src/small-model/checkpoint-6-specialist-dataset.mjs';

const repositoryTrajectoryDir = path.join(process.cwd(), 'datasets', 'trajectories', 'repository-v1');
const multiRuntimeDir = path.join(process.cwd(), 'datasets', 'trajectories', 'multi-runtime-v1');
const outputRoot = path.join(process.cwd(), 'models', 'specialists-checkpoint-6');
const keyBySpecialist = { 'tool-router': 'tool', 'context-scorer': 'context', 'test-selector': 'test', 'patch-ranker': 'patch', 'risk-classifier': 'risk' };

async function decisionInput(scenarioGroup) {
  const input = {};
  for (const specialist of CHECKPOINT_6_SPECIALISTS) {
    const dataset = await buildCheckpoint6SpecialistDataset({ repositoryTrajectoryDir, multiRuntimeDir, specialist });
    const example = dataset.examples.find((entry) => entry.state.scenarioGroup === scenarioGroup);
    assert.ok(example, `${specialist}:${scenarioGroup}`);
    input[keyBySpecialist[specialist]] = example.state;
  }
  return input;
}

test('foundation trains checkpoint 6 suite but cannot activate it without explicit ablation-governed approval', async () => {
  const service = new SmallModelFoundationService();
  assert.equal(service.checkpoint6SuiteStatus().ready, false);
  const prepared = await service.prepareCheckpoint6SpecialistSuite({ repositoryTrajectoryDir, multiRuntimeDir, outputRoot, writeOutputs: false });
  assert.match(prepared.suiteReceiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(service.checkpoint6SuiteStatus().ready, false);
  assert.throws(() => service.promoteCheckpoint6SpecialistSuite({ suiteReceiptSha256: prepared.suiteReceiptSha256 }), /approval/i);
  const promoted = service.promoteCheckpoint6SpecialistSuite({ suiteReceiptSha256: prepared.suiteReceiptSha256, approvedBy: 'checkpoint-owner' });
  assert.equal(promoted.promotions.length, 5);
  assert.equal(service.checkpoint6SuiteStatus().ready, true);
  assert.deepEqual(service.checkpoint6SuiteStatus().missing, []);
  assert.equal(service.status().checkpoint6SpecialistSuiteReady, true);
  assert.equal(service.status().claims.generalCodingIntelligence, false);
});

test('checkpoint 6 decision support requires five ablation-governed active artifacts and remains fail closed', async () => {
  const service = new SmallModelFoundationService();
  assert.throws(() => service.runCheckpoint6DecisionSupport({ tool: {}, context: {}, test: {}, patch: {}, risk: {} }), /ablation-governed/i);
  await service.bootstrapCheckpoint6SpecialistSuite({ repositoryTrajectoryDir, multiRuntimeDir, outputRoot, writeOutputs: false, approvedBy: 'checkpoint-owner' });

  const safe = service.runCheckpoint6DecisionSupport(await decisionInput('advanced-search-service'));
  assert.equal(safe.status, 'allow');
  assert.equal(safe.allowed, true);
  assert.equal(safe.decisions.tool.action, 'search');
  assert.equal(safe.decisions.patch.action, 'accept');
  assert.equal(safe.decisions.risk.action, 'low');

  const unsafe = service.runCheckpoint6DecisionSupport(await decisionInput('browser-injection-guard'));
  assert.equal(unsafe.status, 'blocked');
  assert.equal(unsafe.allowed, false);
  assert.equal(unsafe.requiresApproval, true);
  assert.equal(unsafe.decisions.tool.action, 'stop');
  assert.equal(unsafe.decisions.patch.action, 'reject');
  assert.equal(unsafe.decisions.risk.action, 'critical');
});

test('checkpoint 6 active inference refuses legacy promotions that lack ablation evidence', async () => {
  const service = new SmallModelFoundationService();
  await service.bootstrapRepositorySpecialistSuite({ trajectoryDir: repositoryTrajectoryDir, approvedBy: 'legacy-owner' });
  assert.equal(service.repositorySpecialistSuiteStatus().ready, true);
  assert.equal(service.checkpoint6SuiteStatus().ready, false);
  assert.throws(() => service.inferCheckpoint6Specialist({ specialist: 'risk-classifier', state: { securitySensitive: true } }), /ablation-governed/i);
});
