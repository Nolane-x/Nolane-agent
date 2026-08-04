import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyForensicRecoveryCheckpoint3 } from '../src/forensics/recovery-checkpoint-3.mjs';
import { createModelArtifact } from '../src/small-model/model-artifact.mjs';
import { canonicalSha256 } from '../vendor/forge-os/src/core/canonical-json.mjs';

const H = (char) => char.repeat(64);
function artifact() {
  return createModelArtifact({ specialist: 'tool-router', datasetReceiptSha256: H('d'), trainingConfig: { seed: 'checkpoint-3' }, model: {
    schema: 'nolane.small-model.linear-policy.v1', labels: ['read','test'], dimensions: 4,
    weights: [[0,1,0,0],[0,-1,0,0]], biases: [0,0], training: { examples: 24, epochs: 5, seed: 'checkpoint-3', lossHistory: [1,0.2] },
  } });
}
function benchmark(value) {
  const evaluation = { schema:'nolane.small-model.specialist-evaluation.v1', artifactSha256:value.artifactSha256, specialist:'tool-router', independent:true, heldOut:true, examples:12, correct:12, accuracy:1, abstentions:0, safetyViolations:0, baselineSafetyViolations:0, thresholds:{minAccuracy:.95}, confusion:{'read->read':6,'test->test':6}, allowed:true, claims:{boundedHeldOutEvidence:true,generalCodingIntelligence:false,competitorSuperiority:false}, receiptSha256:H('e') };
  const base = { schema:'nolane.small-model.bootstrap-tool-router-benchmark.v1', artifactSha256:value.artifactSha256, datasetReceiptSha256:H('f'), validation:evaluation, heldOut:evaluation, resourceProfile:{runtime:'node-js-linear-policy',dimensions:4,parameters:10}, claims:{boundedToolRoutingSpecialist:true,generalCodingIntelligence:false,frontierParity:false,competitorSuperiority:false} };
  return { ...base, receiptSha256: canonicalSha256(base) };
}
function validInput(overrides = {}) {
  const model = artifact(); const result = benchmark(model);
  return {
    custody: { records:[{id:'nolane-native-canonical',status:'missing'}] },
    truthLedger: { total:8548,resolved:1353,unresolved:7195,completeParityEligible:false },
    assertionBaseline: { receiptSha256:H('a'), coverage:{ summary:{requirementsTotal:48,requirementsBound:48,requirementsUnbound:0,requirementsPositiveBound:48,requirementsNegativeBound:48,overBroadTestFiles:0}, certifiable:true } },
    masterAudit: { receiptSha256:H('b'), summary:{requirementsTotal:1460,assertionVerified:751,assertionUnbound:621,externalUnverified:88,overBroadTestFiles:32,documentationOnlyEntrypoints:2,missingPositiveAssertions:0,missingNegativeAssertions:21} },
    modelArtifact:model, benchmark:result,
    modelVerification:{status:'pass',artifactSha256:model.artifactSha256,benchmarkReceiptSha256:result.receiptSha256,datasetReceiptSha256:H('f'),receiptSha256:H('c')},
    claims:{completeParityClaimAllowed:false,comparativeSuperiorityClaimAllowed:false,windowsUiCertified:false,providerRealCertified:false,smallModelSuperintelligenceImplemented:false,allOriginalGoalsComplete:false},
    ...overrides,
  };
}

test('checkpoint 3 verifies complete evidence dispositions and a bounded trained specialist without broad claims', () => {
  const result = verifyForensicRecoveryCheckpoint3(validInput());
  assert.equal(result.status,'pass');
  assert.equal(result.uiAuditAssertionBindingsComplete,true);
  assert.equal(result.masterLedgerAssertionDispositionComplete,true);
  assert.equal(result.boundedSpecialistModelTrained,true);
  assert.equal(result.generalCodingIntelligenceClaimAllowed,false);
  assert.equal(result.functionLevelNolaneNativeParityVerified,false);
  assert.equal(result.masterLedger.assertionVerified,751);
  assert.match(result.receiptSha256,/^[a-f0-9]{64}$/);
});

test('checkpoint 3 rejects missing dispositions, fake model evidence, and unlocked claims', () => {
  assert.throws(() => verifyForensicRecoveryCheckpoint3(validInput({ masterAudit:{receiptSha256:H('b'),summary:{requirementsTotal:1460,assertionVerified:751,assertionUnbound:620,externalUnverified:88}} })), /disposition/i);
  const input = validInput();
  const { receiptSha256: ignored, ...badBase } = { ...input.benchmark, claims:{...input.benchmark.claims,competitorSuperiority:true} };
  const badBenchmark = { ...badBase, receiptSha256: canonicalSha256(badBase) };
  assert.throws(() => verifyForensicRecoveryCheckpoint3({ ...input, benchmark:badBenchmark }), /non-claim/i);
  assert.throws(() => verifyForensicRecoveryCheckpoint3(validInput({ claims:{completeParityClaimAllowed:true,comparativeSuperiorityClaimAllowed:false,windowsUiCertified:false,providerRealCertified:false,smallModelSuperintelligenceImplemented:false,allOriginalGoalsComplete:false} })), /protected claim/i);
});
