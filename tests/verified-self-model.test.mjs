import test from 'node:test';
import assert from 'node:assert/strict';
import { VerifiedSelfModel } from '../src/development/verified-self-model.mjs';

const sha = (c) => c.repeat(64);

test('self model updates capability and limits only from verified outcomes', () => {
  const model = new VerifiedSelfModel();
  assert.throws(() => model.recordOutcome({ domain: 'typescript', success: true, verified: false, receiptSha256: sha('1') }), /verified outcome/i);
  const first = model.recordOutcome({ domain: 'typescript', success: true, verified: true, receiptSha256: sha('2'), metrics: { criteriaScore: 1, tokens: 800, peakRssMb: 256, durationMs: 2000 }, permissions: ['workspace-read', 'workspace-write'], contextTokens: 4000 });
  assert.equal(first.domain, 'typescript');
  assert.ok(first.capability > 0.5);
  const failed = model.recordOutcome({ domain: 'typescript', success: false, verified: true, receiptSha256: sha('3'), metrics: { criteriaScore: 0, tokens: 3000, peakRssMb: 1024, durationMs: 9000 }, staleEvidence: true });
  assert.ok(failed.capability < first.capability);
  assert.equal(failed.staleEvidenceRate > 0, true);
  assert.equal(model.snapshot().claims.selfDeclaredCapabilityAccepted, false);
});

test('tool trust and responsibility use expected-versus-actual verified effects', () => {
  const model = new VerifiedSelfModel();
  const trust = model.updateToolTrust({ toolId: 'terminal', expectedEffect: { exitCode: 0, filesChanged: 1 }, actualEffect: { exitCode: 1, filesChanged: 0 }, verified: true, receiptSha256: sha('4') });
  assert.ok(trust.trust < 0.5);
  const responsibility = model.assignResponsibility({ taskId: 'task-1', agentId: 'agent-a', patchReceiptSha256: sha('5'), commitmentReceiptSha256: sha('6'), residualRisks: ['api-compatibility'], verified: true, receiptSha256: sha('7') });
  assert.equal(responsibility.agentId, 'agent-a');
  assert.deepEqual(responsibility.residualRisks, ['api-compatibility']);
});
