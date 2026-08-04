import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalSha256 } from '../vendor/forge-os/src/core/canonical-json.mjs';
import { createModelArtifact } from '../src/small-model/model-artifact.mjs';
import { CHECKPOINT_6_SPECIALISTS } from '../src/small-model/checkpoint-6-specialist-dataset.mjs';
import { verifyForensicRecoveryCheckpoint6 } from '../src/forensics/recovery-checkpoint-6.mjs';

const H = (c) => c.repeat(64);
function withReceipt(base) { return { ...base, receiptSha256: canonicalSha256(base) }; }
function artifact(specialist, index) {
  return createModelArtifact({
    specialist,
    datasetReceiptSha256: H(String(index + 1)),
    trainingConfig: { seed: `cp6-${specialist}` },
    model: { schema: 'nolane.small-model.linear-policy.v1', labels: ['safe', 'unsafe'], dimensions: 8, weights: [[1, ...Array(7).fill(0)], [-1, ...Array(7).fill(0)]], biases: [0, 0], training: { examples: 20, epochs: 5, seed: `cp6-${specialist}`, lossHistory: [1, 0.2] } },
  });
}
function evaluation(a, specialist, baselineSafetyViolations = 0) {
  return withReceipt({ schema: 'nolane.small-model.specialist-evaluation.v1', artifactSha256: a.artifactSha256, specialist, independent: true, heldOut: true, examples: 4, correct: 4, accuracy: 1, abstentions: 0, safetyViolations: 0, baselineSafetyViolations, thresholds: { minAccuracy: 0.8 }, confusion: { 'safe->safe': 2, 'unsafe->unsafe': 2 }, allowed: true, claims: { boundedHeldOutEvidence: true, generalCodingIntelligence: false, competitorSuperiority: false } });
}
function ablation(a, specialist) {
  const model = evaluation(a, specialist, 1);
  const baseline = withReceipt({ schema: 'nolane.small-model.majority-baseline.v1', label: 'safe', counts: { safe: 3, unsafe: 1 }, trainingExamples: 4 });
  const baselineEvaluation = withReceipt({ schema: 'nolane.small-model.majority-baseline-evaluation.v1', baselineReceiptSha256: baseline.receiptSha256, examples: 4, correct: 2, accuracy: 0.5, safetyViolations: 1, confusion: { 'safe->safe': 2, 'unsafe->safe': 2 } });
  return withReceipt({ schema: 'nolane.small-model.checkpoint-6-ablation.v1', artifactSha256: a.artifactSha256, specialist, baseline, baselineEvaluation, model, lift: 0.5, thresholds: { minLift: 0.1, noSafetyRegression: true }, reasons: [], allowed: true, claims: { ablationEligible: true, generalCodingIntelligence: false, competitorSuperiority: false } });
}
function decision(status, allowed) {
  return withReceipt({ schema: 'nolane.small-model.checkpoint-6-decision-support.v1', status, allowed, requiresApproval: !allowed, decisions: { tool: { action: allowed ? 'test' : 'stop' }, context: { action: allowed ? 'support' : 'exclude' }, test: { action: 'full' }, patch: { action: allowed ? 'accept' : 'reject' }, risk: { action: allowed ? 'low' : 'critical' } }, policy: { ablationGovernedArtifactsRequired: true }, hiddenChainOfThoughtStored: false, claims: { boundedMultiRuntimeDecisionSupport: true, generalCodingIntelligence: false, frontierParity: false, competitorSuperiority: false } });
}
function validInput(overrides = {}) {
  const artifacts = {}; const benchmarks = {}; const ablations = {}; const artifactSha256BySpecialist = {}; const benchmarkReceiptSha256BySpecialist = {}; const ablationReceiptSha256BySpecialist = {};
  for (const [index, specialist] of CHECKPOINT_6_SPECIALISTS.entries()) {
    const a = artifact(specialist, index); const heldOut = evaluation(a, specialist); const abl = ablation(a, specialist);
    artifacts[specialist] = a; ablations[specialist] = abl;
    benchmarks[specialist] = withReceipt({ schema: 'nolane.small-model.checkpoint-6-specialist-benchmark.v1', specialist, artifactSha256: a.artifactSha256, datasetReceiptSha256: H('d'), validation: heldOut, heldOut, ablationReceiptSha256: abl.receiptSha256, resourceProfile: { runtime: 'node-js-linear-policy', dimensions: 8, parameters: 18 }, lineage: { repositoryEpisodes: 32, multiRuntimeEpisodes: 7, recoveryEpisodes: 6, projects: ['a','b','c','d','e'], runtimes: ['go','node','python'], mutationObserved: true, recoveryObserved: true }, claims: { boundedMultiRuntimeSpecialist: true, generalCodingIntelligence: false, frontierParity: false, competitorSuperiority: false } });
    artifactSha256BySpecialist[specialist] = a.artifactSha256;
    benchmarkReceiptSha256BySpecialist[specialist] = benchmarks[specialist].receiptSha256;
    ablationReceiptSha256BySpecialist[specialist] = abl.receiptSha256;
  }
  const suiteVerification = withReceipt({ schema: 'nolane.small-model.checkpoint-6-specialist-suite-verification.v1', status: 'pass', lineageReceiptSha256: H('a'), artifactSha256BySpecialist, benchmarkReceiptSha256BySpecialist, ablationReceiptSha256BySpecialist, claims: { generalCodingIntelligence: false, frontierParity: false, competitorSuperiority: false } });
  const multiRuntime = withReceipt({ schema: 'nolane.small-model.multi-runtime-trajectory-dataset.v1', episodeCount: 7, attemptCount: 7, excludedCount: 0, executionEpisodesSha256: H('e'), collectionReceiptSha256: H('c'), runtimes: ['go','node','python'], projects: ['a','b','c','d','e'], hiddenChainOfThoughtStored: false });
  const recovery = withReceipt({ schema: 'nolane.small-model.mutation-recovery-dataset.v1', episodeCount: 6, scenarioCount: 3, recoveryEpisodesSha256: H('b'), recoveryScenariosSha256: H('c'), collectionReceiptSha256: H('d'), runtimes: ['go','node','python'], projects: ['a','b','c'], mutationFailures: 3, recoveryPasses: 3, hiddenChainOfThoughtStored: false });
  const provenance = withReceipt({ schema: 'nolane.release.third-party-provenance.v2', valid: true, noticeSha256: H('e'), historicalResearchAttribution: { upstream: 'Nous Research', upstreamCommit: '846b14ab01a84483d2c3dd429579173040474585', license: 'MIT', runtimeDistributed: false, ownershipClaimed: false, cleanRoomTransformation: true, transformationLedger: 'requirements/nolane-native-transformation-ledger.jsonl' } });
  return {
    custody: { records: [{ id: 'nolane-native-canonical', status: 'missing' }] },
    truthLedger: { total: 8548, resolved: 1353, unresolved: 7195, completeParityEligible: false },
    assertionBaseline: { receiptSha256: H('f'), coverage: { summary: { requirementsTotal: 48, requirementsBound: 48, requirementsUnbound: 0, requirementsPositiveBound: 48, requirementsNegativeBound: 48, overBroadTestFiles: 0 }, certifiable: true } },
    masterAudit: { receiptSha256: H('f'), summary: { requirementsTotal: 1460, assertionVerified: 1372, assertionUnbound: 0, externalUnverified: 88, documentationOnlyEntrypoints: 0, missingNegativeAssertions: 1 } },
    multiRuntime, recovery, suiteArtifacts: artifacts, suiteBenchmarks: benchmarks, suiteAblations: ablations, suiteVerification,
    safeDecisionReceipt: decision('allow', true), unsafeDecisionReceipt: decision('blocked', false), thirdPartyProvenance: provenance,
    claims: { completeParityClaimAllowed: false, comparativeSuperiorityClaimAllowed: false, windowsUiCertified: false, providerRealCertified: false, smallModelSuperintelligenceImplemented: false, allOriginalGoalsComplete: false },
    ...overrides,
  };
}

test('checkpoint 6 verifies complete local assertion evidence multi-runtime recovery and ablation-governed specialists without broad claims', () => {
  const result = verifyForensicRecoveryCheckpoint6(validInput());
  assert.equal(result.status, 'pass');
  assert.equal(result.masterLedger.assertionVerified, 1372);
  assert.equal(result.masterLedger.assertionUnbound, 0);
  assert.equal(result.multiRuntimeTrajectories.episodes, 7);
  assert.equal(result.recoveryTrajectories.mutationFailures, 3);
  assert.equal(result.specialists.length, 5);
  assert.equal(result.localAssertionEvidenceComplete, true);
  assert.equal(result.generalCodingIntelligenceClaimAllowed, false);
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
});

test('checkpoint 6 rejects unbound local evidence weak ablation invalid provenance and unlocked claims', () => {
  const unbound = validInput(); unbound.masterAudit.summary.assertionVerified = 1371; unbound.masterAudit.summary.assertionUnbound = 1;
  assert.throws(() => verifyForensicRecoveryCheckpoint6(unbound), /local assertion evidence/i);
  const weak = validInput(); weak.suiteAblations['tool-router'] = { ...weak.suiteAblations['tool-router'], lift: 0, receiptSha256: H('0') };
  assert.throws(() => verifyForensicRecoveryCheckpoint6(weak), /ablation/i);
  const provenance = validInput(); provenance.thirdPartyProvenance = { ...provenance.thirdPartyProvenance, valid: false };
  assert.throws(() => verifyForensicRecoveryCheckpoint6(provenance), /provenance/i);
  const claims = validInput(); claims.claims.comparativeSuperiorityClaimAllowed = true;
  assert.throws(() => verifyForensicRecoveryCheckpoint6(claims), /protected claim/i);
});


test('checkpoint 6 accepts the historical v1 provenance projection for replay compatibility', () => {
  const input = validInput();
  const current = input.thirdPartyProvenance;
  input.thirdPartyProvenance = withReceipt({
    schema: 'nolane.release.third-party-provenance.v1',
    valid: true,
    noticeSha256: current.noticeSha256,
    nolane_nativeAttribution: current.historicalResearchAttribution,
  });
  assert.equal(verifyForensicRecoveryCheckpoint6(input).status, 'pass');
});
