import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCheckpoint9MissionPortfolio } from '../src/small-model/checkpoint-9-mission-portfolio.mjs';
import { buildCheckpoint9EvidenceBundle } from '../src/small-model/checkpoint-9-evidence-bundle.mjs';
import { SmallModelFoundationService } from '../src/small-model/foundation-service.mjs';
import { verifyForensicRecoveryCheckpoint9 } from '../src/forensics/recovery-checkpoint-9.mjs';
import { canonicalSha256 } from '../src/small-model/shared.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rehash = (value) => { const { receiptSha256: _old, ...base } = value; return { ...base, receiptSha256: canonicalSha256(base) }; };

async function fixture() {
  const service = new SmallModelFoundationService();
  const prepared = await service.prepareCheckpoint9Evidence({ root });
  const promotion = service.promoteCheckpoint9Suite({ bundleReceiptSha256: prepared.bundleReceiptSha256, approvedBy: 'owner' });
  const files = [
    { path: 'src/api.mjs', source: `export function legacyName(value){ return value; }\n` },
    { path: 'src/direct.mjs', source: `import { legacyName } from './api.mjs';\nexport const value = legacyName(1);\n` },
    { path: 'src/alias.mjs', source: `import { legacyName as run } from './api.mjs';\nexport const value = run(2);\n` },
  ];
  const safeExecution = service.executeCheckpoint9Refactor({ files });
  const unsafeBase = { schema: 'nolane.small-model.checkpoint-9-unsafe-execution.v1', status: 'blocked', reason: 'path-outside-scope', allowed: false, requiresApproval: true, hiddenChainOfThoughtStored: false, claims: { generalCodingIntelligence: false, competitorSuperiority: false } };
  return {
    custody: { records: [{ id: 'nolane-native-canonical', status: 'missing' }] },
    truthLedger: { total: 8548, resolved: 1353, unresolved: 7195, completeParityEligible: false },
    assertionBaseline: { receiptSha256: 'a'.repeat(64), coverage: { certifiable: true, summary: { requirementsTotal: 48, requirementsBound: 48, requirementsUnbound: 0, requirementsPositiveBound: 48, requirementsNegativeBound: 48, overBroadTestFiles: 0 } } },
    masterAudit: { receiptSha256: 'b'.repeat(64), summary: { requirementsTotal: 1460, assertionVerified: 1372, assertionUnbound: 0, externalUnverified: 88, documentationOnlyEntrypoints: 0 } },
    portfolio: prepared.portfolio,
    evidenceBundle: prepared.evidenceBundle,
    promotion,
    safeExecution,
    unsafeExecution: { ...unsafeBase, receiptSha256: canonicalSha256(unsafeBase) },
    claims: { completeParityClaimAllowed: false, comparativeSuperiorityClaimAllowed: false, windowsUiCertified: false, providerRealCertified: false, smallModelSuperintelligenceImplemented: false, allOriginalGoalsComplete: false },
  };
}

test('checkpoint 9 truth verifier requires multi-file transfer, property proofs, promotion v5, and locked claims', async () => {
  const report = verifyForensicRecoveryCheckpoint9(await fixture());
  assert.equal(report.status, 'pass');
  assert.equal(report.multiFileTransferVerified, true);
  assert.equal(report.propertyVerificationPassed, true);
  assert.equal(report.promotedSkills, 1);
  assert.equal(report.completeParityClaimAllowed, false);
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
});

test('checkpoint 9 truth verifier rejects property counterexamples, unsafe promotion, and unlocked claims', async () => {
  const input = await fixture();
  const badSmt = rehash({ ...input.portfolio.smtProperties, counterexamples: [{ seed: 1 }] });
  const badPortfolio = rehash({ ...input.portfolio, smtProperties: badSmt });
  assert.throws(() => verifyForensicRecoveryCheckpoint9({ ...input, portfolio: badPortfolio }), /property|counterexample|lineage/i);
  assert.throws(() => verifyForensicRecoveryCheckpoint9({ ...input, claims: { ...input.claims, completeParityClaimAllowed: true } }), /claim/i);
  const unsafePromotion = rehash({ ...input.promotion, approvedBy: '' });
  assert.throws(() => verifyForensicRecoveryCheckpoint9({ ...input, promotion: unsafePromotion }), /approval|promotion/i);
});
