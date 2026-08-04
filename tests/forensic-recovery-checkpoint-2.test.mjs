import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyForensicRecoveryCheckpoint2 } from '../src/forensics/recovery-checkpoint-2.mjs';

function validInput(overrides = {}) {
  return {
    custody: { records: [{ id: 'nolane-native-canonical', status: 'missing' }, { id: 'nolane-package-anchor', status: 'verified' }] },
    symbolInventory: { files: 780, symbols: 6500, surfaces: 1200, parseFailures: 0, inventorySha256: 'a'.repeat(64) },
    truthLedger: { total: 8500, resolved: 1300, unresolved: 7200, completeParityEligible: false },
    assertionBaseline: { receiptSha256: 'b'.repeat(64), coverage: { summary: { requirementsTotal: 48, requirementsBound: 45, requirementsUnbound: 3, requirementsPositiveBound: 45, requirementsNegativeBound: 45, overBroadTestFiles: 0 }, certifiable: false } },
    uiAudit: { defaultUiVersion: 'v3', sourceLocalComplete: true, complete: false, summary: { implemented: 18, partial: 0, missing: 0, externalCertification: 1 } },
    uiRelease: { sourceLocalPass: true, uiV3SourceLocalComplete: true, missingModules: 0, windows8GbCertified: false, screenReaderCertified: false, externalScreenshotCertified: false, receiptSha256: 'c'.repeat(64) },
    claims: { completeParityClaimAllowed: false, comparativeSuperiorityClaimAllowed: false, windowsUiCertified: false, providerRealCertified: false, uiV3Complete: false, uiV3SourceLocalComplete: true },
    ...overrides,
  };
}

test('checkpoint 2 verifies source-local UI without unlocking external or NolaneNative claims', () => {
  const result = verifyForensicRecoveryCheckpoint2(validInput());
  assert.equal(result.status, 'pass');
  assert.equal(result.uiV3SourceLocalComplete, true);
  assert.equal(result.uiV3ExternallyCertified, false);
  assert.equal(result.functionLevelNolaneNativeParityVerified, false);
  assert.equal(result.assertionEvidenceReconstructionComplete, false);
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
});

test('checkpoint 2 rejects partial UI, unlocked claims, and fake external certification', () => {
  assert.throws(() => verifyForensicRecoveryCheckpoint2(validInput({ uiAudit: { defaultUiVersion: 'v3', sourceLocalComplete: false, complete: false, summary: { implemented: 17, partial: 1, missing: 0, externalCertification: 1 } } })), /source-local/i);
  assert.throws(() => verifyForensicRecoveryCheckpoint2(validInput({ claims: { completeParityClaimAllowed: true, comparativeSuperiorityClaimAllowed: false, windowsUiCertified: false, providerRealCertified: false, uiV3Complete: false, uiV3SourceLocalComplete: true } })), /protected claim/i);
  assert.throws(() => verifyForensicRecoveryCheckpoint2(validInput({ uiRelease: { sourceLocalPass: true, uiV3SourceLocalComplete: true, missingModules: 0, windows8GbCertified: true, screenReaderCertified: false, externalScreenshotCertified: false, receiptSha256: 'c'.repeat(64) } })), /external certification/i);
});

test('checkpoint 2 accepts stronger later assertion coverage without unlocking external claims', () => {
  const input = validInput();
  input.assertionBaseline = { receiptSha256:'b'.repeat(64), coverage:{ summary:{ requirementsTotal:48, requirementsBound:48, requirementsUnbound:0, requirementsPositiveBound:48, requirementsNegativeBound:48, overBroadTestFiles:0 }, certifiable:true } };
  const result = verifyForensicRecoveryCheckpoint2(input);
  assert.equal(result.status,'pass');
  assert.equal(result.assertionEvidenceReconstructionComplete,true);
  assert.equal(result.uiV3ExternallyCertified,false);
});
