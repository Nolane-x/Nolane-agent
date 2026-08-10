import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SmallModelFoundationService } from '../src/small-model/foundation-service.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryTrajectoryDir = path.join(root, 'datasets', 'trajectories', 'repository-v1');
const multiRuntimeDir = path.join(root, 'datasets', 'trajectories', 'multi-runtime-v1');
const GO_AVAILABLE = spawnSync(process.env.GO_BINARY || 'go', ['version'], { stdio: 'ignore', windowsHide: true }).status === 0;

test('foundation separates checkpoint 7 mission collection evidence preparation and transfer-governed promotion', { skip: !GO_AVAILABLE ? 'Go runtime is an external checkpoint-7 gate and is unavailable on this host' : undefined }, async () => {
  const service = new SmallModelFoundationService();
  assert.equal(service.checkpoint7Status().ready, false);
  const collected = await service.collectCheckpoint7Missions({ root, trainingRepositoryIds: ['nolane-root', 'go-launcher', 'python-sdk'] });
  assert.equal(collected.primaryMissions.length, 3);
  assert.equal(collected.inductionMissions.length, 2);
  assert.ok(collected.primaryMissions.every((mission) => mission.steps.length >= 7 && mission.bestCandidatePreserved));

  const prepared = await service.prepareCheckpoint7Evidence({ collectionReceiptSha256: collected.receiptSha256, repositoryTrajectoryDir, multiRuntimeDir, writeOutputs: false });
  assert.equal(prepared.status, 'pending-approval');
  assert.equal(prepared.specialists.length, 5);
  assert.equal(prepared.processVerification.schema, 'nolane.small-model.process-reward-verification.v1');
  assert.equal(prepared.skill.schema, 'nolane.small-model.verified-skill.v1');
  assert.equal(prepared.skillTransfer.schema, 'nolane.small-model.skill-transfer-verification.v1');
  assert.equal(Object.keys(prepared.evidenceBundles).length, 5);
  assert.equal(service.checkpoint7Status().ready, false);
  assert.throws(() => service.promoteCheckpoint7Suite({ bundleReceiptSha256: prepared.bundleReceiptSha256 }), /approval/i);

  const promoted = service.promoteCheckpoint7Suite({ bundleReceiptSha256: prepared.bundleReceiptSha256, approvedBy: 'checkpoint-owner' });
  assert.equal(promoted.specialistPromotions.length, 5);
  assert.equal(promoted.processPromotion.schema, 'nolane.small-model.artifact-promotion.v2');
  assert.equal(service.checkpoint7Status().ready, true);
  assert.equal(service.status().checkpoint7Ready, true);
  assert.equal(service.status().claims.generalCodingIntelligence, false);
});

test('checkpoint 7 decision support requires v3 artifacts and blocks regression process steps', { skip: !GO_AVAILABLE ? 'Go runtime is an external checkpoint-7 gate and is unavailable on this host' : undefined }, async () => {
  const service = new SmallModelFoundationService();
  assert.throws(() => service.runCheckpoint7DecisionSupport({}), /transfer-governed|active/i);
  const collected = await service.collectCheckpoint7Missions({ root, trainingRepositoryIds: [] });
  const prepared = await service.prepareCheckpoint7Evidence({ collectionReceiptSha256: collected.receiptSha256, repositoryTrajectoryDir, multiRuntimeDir, writeOutputs: false });
  service.promoteCheckpoint7Suite({ bundleReceiptSha256: prepared.bundleReceiptSha256, approvedBy: 'checkpoint-owner' });

  const safe = service.runCheckpoint7DecisionSupport(prepared.decisionFixtures.safe);
  assert.equal(safe.status, 'allow');
  assert.equal(safe.allowed, true);
  assert.equal(safe.process.action, 'progress');

  const unsafe = service.runCheckpoint7DecisionSupport(prepared.decisionFixtures.unsafe);
  assert.equal(unsafe.status, 'blocked');
  assert.equal(unsafe.allowed, false);
  assert.equal(unsafe.process.action, 'regression');
  assert.equal(unsafe.requiresApproval, true);
});
