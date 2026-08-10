import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SmallModelFoundationService } from '../src/small-model/foundation-service.mjs';
import { canonicalSha256 } from '../src/small-model/shared.mjs';
import { verifyForensicRecoveryCheckpoint7 } from '../src/forensics/recovery-checkpoint-7.mjs';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryTrajectoryDir = path.join(root, 'datasets/trajectories/repository-v1');
const multiRuntimeDir = path.join(root, 'datasets/trajectories/multi-runtime-v1');
const goAvailable = (() => { try { execFileSync('go', ['version'], { stdio: 'ignore' }); return true; } catch { return false; } })();

const claims = {
  completeParityClaimAllowed: false,
  comparativeSuperiorityClaimAllowed: false,
  windowsUiCertified: false,
  providerRealCertified: false,
  smallModelSuperintelligenceImplemented: false,
  allOriginalGoalsComplete: false,
};

const inputPromise = goAvailable ? (async () => {
  const service = new SmallModelFoundationService();
  const missionCollection = await service.collectCheckpoint7Missions({ root, trainingRepositoryIds: ['nolane-root'] });
  const preparation = await service.prepareCheckpoint7Evidence({ collectionReceiptSha256: missionCollection.receiptSha256, repositoryTrajectoryDir, multiRuntimeDir, writeOutputs: false });
  const promotion = service.promoteCheckpoint7Suite({ bundleReceiptSha256: preparation.bundleReceiptSha256, approvedBy: 'checkpoint-owner' });
  const safeDecisionReceipt = service.runCheckpoint7DecisionSupport(preparation.decisionFixtures.safe);
  const unsafeDecisionReceipt = service.runCheckpoint7DecisionSupport(preparation.decisionFixtures.unsafe);
  const specialistArtifacts = Object.fromEntries(Object.entries(preparation.evidenceBundles).map(([key, value]) => [key, service.artifactRegistry.get(value.artifactSha256)]));
  return {
    custody: { records: [{ id: 'nolane-native-canonical', status: 'missing' }] },
    truthLedger: { total: 8548, resolved: 1353, unresolved: 7195, completeParityEligible: false },
    assertionBaseline: { receiptSha256: 'f'.repeat(64), coverage: { summary: { requirementsTotal: 48, requirementsBound: 48, requirementsUnbound: 0, requirementsPositiveBound: 48, requirementsNegativeBound: 48, overBroadTestFiles: 0 }, certifiable: true } },
    masterAudit: { receiptSha256: 'e'.repeat(64), summary: { requirementsTotal: 1460, assertionVerified: 1372, assertionUnbound: 0, externalUnverified: 88, documentationOnlyEntrypoints: 0 } },
    missionCollection,
    preparation,
    promotion,
    processArtifact: service.artifactRegistry.get(preparation.processArtifactSha256),
    specialistArtifacts,
    safeDecisionReceipt,
    unsafeDecisionReceipt,
    claims,
  };
})() : Promise.resolve(null);

const clone = (value) => structuredClone(value);

test('checkpoint 7 verifies held-out missions process reward transferable skill promotion v3 and fail-closed decisions', { skip: !goAvailable }, async () => {
  const result = verifyForensicRecoveryCheckpoint7(await inputPromise);
  assert.equal(result.status, 'pass');
  assert.equal(result.missions.primary, 3);
  assert.equal(result.missions.induction, 2);
  assert.equal(result.specialists.length, 5);
  assert.equal(result.processRewardVerified, true);
  assert.equal(result.skillTransferVerified, true);
  assert.equal(result.generalCodingIntelligenceClaimAllowed, false);
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
});

test('checkpoint 7 rejects incomplete missions legacy promotion regression decisions and unlocked claims', { skip: !goAvailable }, async () => {
  const source = await inputPromise;
  const mission = clone(source); mission.missionCollection.primaryMissions[0].bestCandidatePreserved = false;
  assert.throws(() => verifyForensicRecoveryCheckpoint7(mission), /best candidate|mission/i);
  const legacy = clone(source); legacy.promotion.specialistPromotions[0].schema = 'nolane.small-model.artifact-promotion.v2';
  { const { receiptSha256, ...base } = legacy.promotion; legacy.promotion.receiptSha256 = canonicalSha256(base); }
  assert.throws(() => verifyForensicRecoveryCheckpoint7(legacy), /promotion v3|transfer/i);
  const unsafe = clone(source); unsafe.unsafeDecisionReceipt.process.action = 'progress';
  { const { receiptSha256, ...base } = unsafe.unsafeDecisionReceipt; unsafe.unsafeDecisionReceipt.receiptSha256 = canonicalSha256(base); }
  assert.throws(() => verifyForensicRecoveryCheckpoint7(unsafe), /regression/i);
  const claim = clone(source); claim.claims.smallModelSuperintelligenceImplemented = true;
  assert.throws(() => verifyForensicRecoveryCheckpoint7(claim), /protected claim/i);
});
