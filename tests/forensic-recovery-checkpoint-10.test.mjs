import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { SmallModelFoundationService } from '../src/small-model/foundation-service.mjs';
import { loadCheckpoint10TypeScriptPack } from '../src/small-model/checkpoint-10-typescript-pack.mjs';
import { CHECKPOINT_10_CONTRACT_MANIFEST } from '../src/small-model/checkpoint-10-mission-portfolio.mjs';
import { verifyForensicRecoveryCheckpoint10 } from '../src/forensics/recovery-checkpoint-10.mjs';
import { canonicalSha256 } from '../src/small-model/shared.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rehash = (value) => { const { receiptSha256: _old, ...base } = value; return { ...base, receiptSha256: canonicalSha256(base) }; };
async function typeScriptFiles() { const pack = await loadCheckpoint10TypeScriptPack({ root, id: 'transfer-c' }); return Promise.all(pack.sourceFiles.map(async (e) => ({ path: e.path, source: await readFile(path.join(root, pack.rootPath, e.path), 'utf8') }))); }
async function contractFiles() { return Promise.all(Object.values(CHECKPOINT_10_CONTRACT_MANIFEST.targets).map(async (p) => ({ path: p, source: await readFile(path.join(root, 'fixtures/checkpoint-10-contract', p), 'utf8') }))); }
async function fixture() {
  const service = new SmallModelFoundationService();
  const prepared = await service.prepareCheckpoint10Evidence({ root });
  const promotion = service.promoteCheckpoint10Suite({ bundleReceiptSha256: prepared.bundleReceiptSha256, approvedBy: 'owner' });
  const safeTypeScriptExecution = service.executeCheckpoint10TypeScriptRefactor({ files: await typeScriptFiles(), targetName: 'CanonicalPayload', replacement: 'PromotedPayload' });
  const safeContractMigration = service.executeCheckpoint10ContractMigration({ manifest: CHECKPOINT_10_CONTRACT_MANIFEST, files: await contractFiles() });
  const unsafeBase = { schema: 'nolane.small-model.checkpoint-10-unsafe-execution.v1', status: 'blocked', reason: 'path-outside-scope', allowed: false, requiresApproval: true, attemptedPath: '../outside.ts', hiddenChainOfThoughtStored: false, claims: { generalCodingIntelligence: false, competitorSuperiority: false, externalRepositoryGeneralization: false } };
  return {
    custody: { records: [{ id: 'nolane-native-canonical', status: 'missing' }] },
    truthLedger: { total: 8548, resolved: 1353, unresolved: 7195, completeParityEligible: false },
    assertionBaseline: { receiptSha256: 'a'.repeat(64), coverage: { certifiable: true, summary: { requirementsTotal: 48, requirementsBound: 48, requirementsUnbound: 0, requirementsPositiveBound: 48, requirementsNegativeBound: 48, overBroadTestFiles: 0 } } },
    masterAudit: { receiptSha256: 'b'.repeat(64), summary: { requirementsTotal: 1460, assertionVerified: 1372, assertionUnbound: 0, externalUnverified: 88, documentationOnlyEntrypoints: 0 } },
    portfolio: prepared.portfolio, evidenceBundle: prepared.evidenceBundle, promotion,
    safeTypeScriptExecution, safeContractMigration,
    unsafeExecution: { ...unsafeBase, receiptSha256: canonicalSha256(unsafeBase) },
    claims: { completeParityClaimAllowed: false, comparativeSuperiorityClaimAllowed: false, windowsUiCertified: false, providerRealCertified: false, smallModelSuperintelligenceImplemented: false, allOriginalGoalsComplete: false, externalRepositoryGeneralization: false, generalCodingIntelligence: false },
  };
}

test('checkpoint 10 truth verifier requires semantic transfer, property trials, cross-language migration, promotion v6, and locked claims', async () => {
  const report = verifyForensicRecoveryCheckpoint10(await fixture());
  assert.equal(report.status, 'pass');
  assert.equal(report.typeScriptSemanticTransferVerified, true);
  assert.equal(report.crossLanguageMigrationVerified, true);
  assert.equal(report.propertyVerificationPassed, true);
  assert.equal(report.completeParityClaimAllowed, false);
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
});

test('checkpoint 10 truth verifier rejects counterexamples, broken migration, unsafe promotion, and unlocked claims', async () => {
  const input = await fixture();
  const badProperties = rehash({ ...input.portfolio.typescriptProperties, counterexamples: [{ seed: 1 }] });
  const badPortfolio = rehash({ ...input.portfolio, typescriptProperties: badProperties });
  assert.throws(() => verifyForensicRecoveryCheckpoint10({ ...input, portfolio: badPortfolio }), /property|counterexample|lineage/i);
  const badContract = rehash({ ...input.safeContractMigration, pythonSyntaxValid: false });
  assert.throws(() => verifyForensicRecoveryCheckpoint10({ ...input, safeContractMigration: badContract }), /cross-language|Python|migration/i);
  const badPromotion = rehash({ ...input.promotion, approvedBy: '' });
  assert.throws(() => verifyForensicRecoveryCheckpoint10({ ...input, promotion: badPromotion }), /approval|promotion/i);
  assert.throws(() => verifyForensicRecoveryCheckpoint10({ ...input, claims: { ...input.claims, completeParityClaimAllowed: true } }), /claim/i);
});
