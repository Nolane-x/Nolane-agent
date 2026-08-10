import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SmallModelFoundationService } from '../src/small-model/foundation-service.mjs';
import { canonicalSha256 } from '../src/small-model/shared.mjs';
import { verifyForensicRecoveryCheckpoint8 } from '../src/forensics/recovery-checkpoint-8.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const claims = {
  completeParityClaimAllowed: false,
  comparativeSuperiorityClaimAllowed: false,
  windowsUiCertified: false,
  providerRealCertified: false,
  smallModelSuperintelligenceImplemented: false,
  allOriginalGoalsComplete: false,
};

const inputPromise = (async () => {
  const service = new SmallModelFoundationService();
  const preparation = await service.prepareCheckpoint8Evidence({ root });
  const promotion = service.promoteCheckpoint8Suite({ bundleReceiptSha256: preparation.bundleReceiptSha256, approvedBy: 'checkpoint-owner' });
  const safeExecution = service.executeCheckpoint8AstSkill({ skillId: 'rename-legacy-name', path: 'src/value.mjs', source: 'const legacyName = 1;' });
  const unsafeBase = { schema: 'nolane.small-model.checkpoint-8-unsafe-execution.v1', status: 'blocked', reason: 'path-outside-scope', allowed: false, requiresApproval: true, claims: { generalCodingIntelligence: false, competitorSuperiority: false } };
  const unsafeExecution = { ...unsafeBase, receiptSha256: canonicalSha256(unsafeBase) };
  return {
    custody: { records: [{ id: 'nolane-native-canonical', status: 'missing' }] },
    truthLedger: { total: 8548, resolved: 1353, unresolved: 7195, completeParityEligible: false },
    assertionBaseline: { receiptSha256: 'f'.repeat(64), coverage: { summary: { requirementsTotal: 48, requirementsBound: 48, requirementsUnbound: 0, requirementsPositiveBound: 48, requirementsNegativeBound: 48, overBroadTestFiles: 0 }, certifiable: true } },
    masterAudit: { receiptSha256: 'e'.repeat(64), summary: { requirementsTotal: 1460, assertionVerified: 1372, assertionUnbound: 0, externalUnverified: 88, documentationOnlyEntrypoints: 0 } },
    portfolio: preparation.portfolio,
    evidenceBundle: preparation.evidenceBundle,
    promotion,
    safeExecution,
    unsafeExecution,
    claims,
  };
})();

const clone = (value) => structuredClone(value);

test('checkpoint 8 verifies AST transfer, constraint proofs, portfolio, promotion v4, and locked non-claims', async () => {
  const result = verifyForensicRecoveryCheckpoint8(await inputPromise);
  assert.equal(result.status, 'pass');
  assert.equal(result.missions, 5);
  assert.equal(result.promotedSkills, 3);
  assert.equal(result.astTransferVerified, true);
  assert.equal(result.constraintProofsVerified, true);
  assert.equal(result.generalCodingIntelligenceClaimAllowed, false);
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
});

test('checkpoint 8 rejects missing transfer, proof, legacy promotion, unsafe allow, and unlocked claims', async () => {
  const source = await inputPromise;
  const transfer = clone(source); transfer.portfolio.astTransfer.repositoryDisjoint = false;
  assert.throws(() => verifyForensicRecoveryCheckpoint8(transfer), /hash|transfer|disjoint/i);
  const proof = clone(source); proof.portfolio.smtProof.unsat.status = 'sat';
  assert.throws(() => verifyForensicRecoveryCheckpoint8(proof), /hash|unsat|proof/i);
  const legacy = clone(source); legacy.promotion.promotions[0].schema = 'nolane.small-model.skill-promotion.v3';
  { const { receiptSha256, ...base } = legacy.promotion; legacy.promotion.receiptSha256 = canonicalSha256(base); }
  assert.throws(() => verifyForensicRecoveryCheckpoint8(legacy), /promotion v4/i);
  const unsafe = clone(source); unsafe.unsafeExecution.allowed = true;
  assert.throws(() => verifyForensicRecoveryCheckpoint8(unsafe), /hash|unsafe|blocked/i);
  const claim = clone(source); claim.claims.completeParityClaimAllowed = true;
  assert.throws(() => verifyForensicRecoveryCheckpoint8(claim), /protected claim/i);
});
