import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalSha256 } from '../src/small-model/shared.mjs';
import { trainLinearPolicy } from '../src/small-model/linear-policy-trainer.mjs';
import { createModelArtifact } from '../src/small-model/model-artifact.mjs';
import { evaluateSpecialistArtifact } from '../src/small-model/specialist-evaluation.mjs';
import { runCheckpoint6Ablation } from '../src/small-model/checkpoint-6-ablation-runner.mjs';
import { ModelArtifactRegistry } from '../src/small-model/model-artifact-registry.mjs';
import { buildCheckpoint7EvidenceBundle } from '../src/small-model/checkpoint-7-evidence-bundle.mjs';

const withReceipt = (base) => ({ ...base, receiptSha256: canonicalSha256(base) });

function fixture() {
  const train = [
    { state: { signal: 'safe', safetyCritical: false }, action: { type: 'allow' } },
    { state: { signal: 'unsafe', safetyCritical: true }, action: { type: 'block' } },
    { state: { signal: 'safe', safetyCritical: false }, action: { type: 'allow' } },
  ];
  const heldOut = [
    { state: { signal: 'safe', safetyCritical: false }, action: { type: 'allow' } },
    { state: { signal: 'unsafe', safetyCritical: true }, action: { type: 'block' } },
  ];
  const model = trainLinearPolicy({ examples: train, dimensions: 32, epochs: 200, seed: 'cp7-promotion' });
  const artifact = createModelArtifact({ model, datasetReceiptSha256: 'd'.repeat(64), specialist: 'risk-classifier' });
  const evaluation = evaluateSpecialistArtifact({ artifact, examples: heldOut, independent: true, heldOut: true, minAccuracy: 0.5, baselineSafetyViolations: 0 });
  const ablation = runCheckpoint6Ablation({ artifact, train, heldOut, minLift: 0, baselineSafetyViolations: 0 });
  const processReward = withReceipt({ schema: 'nolane.small-model.process-reward-verification.v1', status: 'pass', artifactSha256: 'p'.repeat(64), heldOutAccuracy: 1, lift: 0.5, claims: { generalCodingIntelligence: false, competitorSuperiority: false } });
  const skillTransfer = withReceipt({ schema: 'nolane.small-model.skill-transfer-verification.v1', status: 'pass', repositoryId: 'heldout-node-normalizer-transfer', sourceRepositoryIds: ['heldout-node-normalizer'], repositoryDisjoint: true, solverApplied: true, testPassed: true, rollbackRestoredInputHash: true, trackedSourceUnchanged: true, workspaceRemoved: true, claims: { boundedTransfer: true, generalCodingIntelligence: false, competitorSuperiority: false } });
  const bundle = buildCheckpoint7EvidenceBundle({
    artifact, evaluation, ablation, processReward, skillTransfer,
    baselineCost: { name: 'baseline', quality: 1, successRate: 1, safetyViolations: 0, tokens: 100, flops: 100, rssMbSeconds: 100, wallMs: 100, humanCorrections: 0 },
    candidateCost: { name: 'candidate', quality: 1, successRate: 1, safetyViolations: 0, tokens: 40, flops: 40, rssMbSeconds: 40, wallMs: 40, humanCorrections: 0 },
  });
  return { artifact, evaluation, ablation, processReward, skillTransfer, bundle };
}

test('promotion v3 requires transfer process cost ablation evaluation and explicit approval', () => {
  const { artifact, evaluation, ablation, bundle } = fixture();
  const registry = new ModelArtifactRegistry();
  registry.register(artifact);
  assert.throws(() => registry.promoteWithTransferEvidence({ artifactSha256: artifact.artifactSha256, evaluation, ablation, evidenceBundle: bundle }), /approval/i);
  const receipt = registry.promoteWithTransferEvidence({ artifactSha256: artifact.artifactSha256, evaluation, ablation, evidenceBundle: bundle, approvedBy: 'owner' });
  assert.equal(receipt.schema, 'nolane.small-model.artifact-promotion.v3');
  assert.equal(receipt.governance, 'transfer-process-cost-required');
  assert.equal(registry.activeTransferEligible('risk-classifier').artifactSha256, artifact.artifactSha256);
  assert.match(receipt.receiptSha256, /^[a-f0-9]{64}$/);
});

test('promotion v3 rejects legacy partial tampered overlapping nonpositive and cost-regressing evidence', () => {
  const { artifact, evaluation, ablation, bundle } = fixture();
  const make = () => { const registry = new ModelArtifactRegistry(); registry.register(artifact); return registry; };
  assert.throws(() => make().promoteWithTransferEvidence({ artifactSha256: artifact.artifactSha256, evaluation, ablation, evidenceBundle: null, approvedBy: 'owner' }), /evidence bundle/i);

  const tampered = structuredClone(bundle); tampered.transfer.repositoryDisjoint = false;
  assert.throws(() => make().promoteWithTransferEvidence({ artifactSha256: artifact.artifactSha256, evaluation, ablation, evidenceBundle: tampered, approvedBy: 'owner' }), /hash|disjoint/i);

  const overlap = structuredClone(bundle); overlap.transfer = withReceipt({ ...overlap.transfer, receiptSha256: undefined, repositoryDisjoint: false }); overlap.receiptSha256 = canonicalSha256({ ...overlap, receiptSha256: undefined });
  assert.throws(() => make().promoteWithTransferEvidence({ artifactSha256: artifact.artifactSha256, evaluation, ablation, evidenceBundle: overlap, approvedBy: 'owner' }), /disjoint/i);

  const process = structuredClone(bundle); process.process = withReceipt({ ...process.process, receiptSha256: undefined, delta: 0 }); process.receiptSha256 = canonicalSha256({ ...process, receiptSha256: undefined });
  assert.throws(() => make().promoteWithTransferEvidence({ artifactSha256: artifact.artifactSha256, evaluation, ablation, evidenceBundle: process, approvedBy: 'owner' }), /process.*delta/i);

  const cost = structuredClone(bundle); cost.cost = withReceipt({ ...cost.cost, receiptSha256: undefined, totalCostRatio: 1.2 }); cost.receiptSha256 = canonicalSha256({ ...cost, receiptSha256: undefined });
  assert.throws(() => make().promoteWithTransferEvidence({ artifactSha256: artifact.artifactSha256, evaluation, ablation, evidenceBundle: cost, approvedBy: 'owner' }), /cost/i);

  const mismatch = structuredClone(bundle); mismatch.artifactSha256 = 'f'.repeat(64); mismatch.receiptSha256 = canonicalSha256({ ...mismatch, receiptSha256: undefined });
  assert.throws(() => make().promoteWithTransferEvidence({ artifactSha256: artifact.artifactSha256, evaluation, ablation, evidenceBundle: mismatch, approvedBy: 'owner' }), /artifact mismatch/i);
});
