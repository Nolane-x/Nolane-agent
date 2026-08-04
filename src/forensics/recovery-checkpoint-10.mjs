import { canonicalSha256, deepFreeze } from '../small-model/shared.mjs';

const SHA256 = /^[a-f0-9]{64}$/;
const PROTECTED = Object.freeze([
  'completeParityClaimAllowed',
  'comparativeSuperiorityClaimAllowed',
  'windowsUiCertified',
  'providerRealCertified',
  'smallModelSuperintelligenceImplemented',
  'allOriginalGoalsComplete',
  'externalRepositoryGeneralization',
  'generalCodingIntelligence',
]);

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} is required`);
  return value;
}
function hash(value, label) {
  if (!SHA256.test(String(value ?? ''))) throw new Error(`${label} hash is invalid`);
  return value;
}
function verifyReceipt(value, label) {
  const { receiptSha256, ...base } = object(value, label);
  hash(receiptSha256, `${label} receipt`);
  if (canonicalSha256(base) !== receiptSha256) throw new Error(`${label} receipt hash mismatch`);
  return value;
}
function verifyClaims(claims) {
  const value = object(claims, 'Protected claims');
  for (const claim of PROTECTED) if (value[claim] !== false) throw new Error(`Protected claim must remain false: ${claim}`);
  return value;
}
function verifyTypeScriptMission(mission, label) {
  verifyReceipt(mission, label);
  if (mission.schema !== 'nolane.small-model.checkpoint-10-typescript-mission.v1') throw new Error(`${label} schema is invalid`);
  if (!['verified-recovery', 'verified-transfer'].includes(mission.status)) throw new Error(`${label} status is invalid`);
  if (Number(mission.changedFiles) < 5 || Number(mission.changedTokens) < 5) throw new Error(`${label} semantic coverage is incomplete`);
  if (mission.bestCandidatePreserved !== true || mission.rollbackRestoredAllHashes !== true || mission.trackedSourcesUnchanged !== true) throw new Error(`${label} recovery evidence is invalid`);
  if (mission.typeSpaceCovered !== true || mission.namespaceImportCovered !== true || mission.reExportChainCovered !== true) throw new Error(`${label} TypeScript semantic coverage is incomplete`);
  if (mission.shellUsed !== false || mission.executedSource !== false || mission.hiddenChainOfThoughtStored !== false) throw new Error(`${label} execution boundary is invalid`);
  return mission;
}

export function verifyForensicRecoveryCheckpoint10(input = {}) {
  const custody = object(input.custody, 'Source custody');
  const nolane_native = custody.records?.find((record) => record.id === 'nolane-native-canonical');
  if (!nolane_native || !['missing', 'unverified'].includes(nolane_native.status)) throw new Error('NolaneNative canonical custody must remain missing or unverified');

  const truth = object(input.truthLedger, 'NolaneNative truth ledger');
  if (Number(truth.total) !== 8548 || Number(truth.resolved) !== 1353 || Number(truth.unresolved) !== 7195 || truth.completeParityEligible !== false) throw new Error('NolaneNative truth ledger must remain unresolved and parity-ineligible');

  const assertion = object(input.assertionBaseline, 'Assertion baseline');
  hash(assertion.receiptSha256, 'Assertion baseline');
  const assertionSummary = object(assertion.coverage?.summary, 'Assertion summary');
  if (assertion.coverage?.certifiable !== true || assertionSummary.requirementsTotal !== 48 || assertionSummary.requirementsBound !== 48 || assertionSummary.requirementsUnbound !== 0 || assertionSummary.requirementsPositiveBound !== 48 || assertionSummary.requirementsNegativeBound !== 48 || assertionSummary.overBroadTestFiles !== 0) throw new Error('UI and audit assertion baseline is incomplete');

  const audit = object(input.masterAudit?.summary, 'Master Ledger assertion audit');
  hash(input.masterAudit?.receiptSha256, 'Master Ledger assertion audit');
  if (audit.requirementsTotal !== 1460 || audit.assertionVerified !== 1372 || audit.assertionUnbound !== 0 || audit.externalUnverified !== 88 || audit.documentationOnlyEntrypoints !== 0) throw new Error('Master Ledger local assertion evidence is incomplete');

  const portfolio = verifyReceipt(input.portfolio, 'Checkpoint 10 portfolio');
  if (portfolio.schema !== 'nolane.small-model.checkpoint-10-mission-portfolio.v1' || portfolio.status !== 'verified' || !Array.isArray(portfolio.missions) || portfolio.missions.length !== 5) throw new Error('Checkpoint 10 portfolio must contain five verified missions');
  if (!Array.isArray(portfolio.inductionMissions) || portfolio.inductionMissions.length !== 2) throw new Error('Checkpoint 10 induction missions are incomplete');
  portfolio.inductionMissions.forEach((mission, index) => verifyTypeScriptMission(mission, `Checkpoint 10 induction mission ${index}`));
  if (portfolio.bestCandidatePreserved !== true || portfolio.hiddenChainOfThoughtStored !== false || Number(portfolio.processValue) <= 0) throw new Error('Checkpoint 10 process evidence is invalid');

  const skill = verifyReceipt(portfolio.typescriptSkill, 'Checkpoint 10 TypeScript skill');
  if (skill.schema !== 'nolane.small-model.typescript-refactor-skill.v1' || skill.kind !== 'typescript-semantic-refactor' || skill.id !== 'rename-typescript-public-api' || skill.hiddenChainOfThoughtStored !== false || !Array.isArray(skill.allowedPaths) || skill.allowedPaths.length < 5) throw new Error('Checkpoint 10 TypeScript skill is invalid');

  const transfer = verifyReceipt(portfolio.typescriptTransfer, 'Checkpoint 10 TypeScript transfer');
  if (transfer.schema !== 'nolane.small-model.checkpoint-10-typescript-transfer.v1' || transfer.status !== 'pass' || transfer.repositoryDisjoint !== true || transfer.rollbackRestoredAllHashes !== true || transfer.trackedSourcesUnchanged !== true || transfer.typeSpaceCovered !== true || transfer.namespaceImportCovered !== true || transfer.reExportChainCovered !== true || transfer.bestCandidatePreserved !== true || transfer.hiddenChainOfThoughtStored !== false) throw new Error('Checkpoint 10 TypeScript transfer evidence is invalid');
  verifyTypeScriptMission(transfer.mission, 'Checkpoint 10 transfer mission');
  if (transfer.missionReceiptSha256 !== transfer.mission.receiptSha256 || transfer.skillReceiptSha256 !== skill.receiptSha256) throw new Error('Checkpoint 10 transfer lineage mismatch');

  const properties = verifyReceipt(portfolio.typescriptProperties, 'Checkpoint 10 TypeScript properties');
  if (properties.schema !== 'nolane.small-model.typescript-refactor-properties.v1' || Number(properties.trials) < 24 || !Array.isArray(properties.counterexamples) || properties.counterexamples.length !== 0 || properties.referenceAgreement !== true || Number(properties.namespaceCases) < 1 || Number(properties.typeOnlyCases) < 1 || Number(properties.reExportCases) < 1 || properties.hiddenChainOfThoughtStored !== false) throw new Error('Checkpoint 10 property verification is insufficient');

  const contract = verifyReceipt(portfolio.contractMigration, 'Checkpoint 10 cross-language migration');
  if (contract.schema !== 'nolane.small-model.cross-language-contract-migration.v1' || Number(contract.changedFiles) !== 2 || contract.typescriptSyntaxValid !== true || contract.pythonSyntaxValid !== true || contract.rollbackRestoresAllHashes !== true || contract.executedGeneratedCode !== false || contract.shellUsed !== false || contract.hiddenChainOfThoughtStored !== false) throw new Error('Checkpoint 10 cross-language migration is invalid');

  const bundle = verifyReceipt(input.evidenceBundle, 'Checkpoint 10 evidence bundle');
  verifyReceipt(bundle.process, 'Checkpoint 10 process evidence');
  verifyReceipt(bundle.cost, 'Checkpoint 10 cost evidence');
  if (bundle.schema !== 'nolane.small-model.checkpoint-10-evidence-bundle.v1' || bundle.allowed !== true || bundle.portfolioReceiptSha256 !== portfolio.receiptSha256 || bundle.typescriptSkillReceiptSha256 !== skill.receiptSha256 || bundle.transferReceiptSha256 !== transfer.receiptSha256 || bundle.propertyReceiptSha256 !== properties.receiptSha256 || bundle.crossLanguageReceiptSha256 !== contract.receiptSha256 || bundle.process.allowed !== true || bundle.cost.allowed !== true || bundle.cost.candidateCostLower !== true || !(Number(bundle.cost.totalCostRatio) < 1) || bundle.safety?.noRegression !== true) throw new Error('Checkpoint 10 evidence bundle is invalid');
  if (bundle.claims?.generalCodingIntelligence !== false || bundle.claims?.competitorSuperiority !== false || bundle.claims?.frontierParity !== false || bundle.claims?.externalRepositoryGeneralization !== false) throw new Error('Checkpoint 10 evidence non-claims must remain locked');

  const promotion = verifyReceipt(input.promotion, 'Checkpoint 10 suite promotion');
  if (promotion.schema !== 'nolane.small-model.checkpoint-10-suite-promotion.v1' || promotion.bundleReceiptSha256 !== bundle.receiptSha256 || !String(promotion.approvedBy ?? '').trim() || promotion.status?.ready !== true) throw new Error('Checkpoint 10 suite promotion requires approval');
  const item = verifyReceipt(promotion.promotion, 'Checkpoint 10 promotion v6');
  if (item.schema !== 'nolane.small-model.skill-promotion.v6' || item.status !== 'promoted' || item.governance !== 'typescript-transfer-property-cross-language-process-cost-required' || item.evidenceBundleReceiptSha256 !== bundle.receiptSha256 || item.transferReceiptSha256 !== transfer.receiptSha256 || item.propertyReceiptSha256 !== properties.receiptSha256 || item.crossLanguageReceiptSha256 !== contract.receiptSha256 || !String(item.approvedBy ?? '').trim()) throw new Error('Promotion v6 evidence is required');

  const safeTypeScript = verifyReceipt(input.safeTypeScriptExecution, 'Checkpoint 10 safe TypeScript execution');
  if (safeTypeScript.schema !== 'nolane.small-model.checkpoint-10-typescript-execution.v1' || Number(safeTypeScript.changedFiles) < 5 || Number(safeTypeScript.changedTokens) < 5 || safeTypeScript.executedSource !== false || safeTypeScript.shellUsed !== false || safeTypeScript.hiddenChainOfThoughtStored !== false) throw new Error('Checkpoint 10 safe TypeScript execution is invalid');

  const safeContract = verifyReceipt(input.safeContractMigration, 'Checkpoint 10 safe contract migration');
  if (safeContract.schema !== 'nolane.small-model.cross-language-contract-migration.v1' || Number(safeContract.changedFiles) !== 2 || safeContract.typescriptSyntaxValid !== true || safeContract.pythonSyntaxValid !== true || safeContract.rollbackRestoresAllHashes !== true || safeContract.executedGeneratedCode !== false || safeContract.shellUsed !== false) throw new Error('Checkpoint 10 cross-language migration execution is invalid');

  const unsafe = verifyReceipt(input.unsafeExecution, 'Checkpoint 10 unsafe execution');
  if (unsafe.schema !== 'nolane.small-model.checkpoint-10-unsafe-execution.v1' || unsafe.status !== 'blocked' || unsafe.allowed !== false || unsafe.requiresApproval !== true || unsafe.hiddenChainOfThoughtStored !== false) throw new Error('Checkpoint 10 unsafe execution must remain blocked');

  verifyClaims(input.claims);

  const base = {
    schema: 'nolane.forensics.recovery-checkpoint-10-verification.v1',
    status: 'pass',
    localAssertionEvidenceComplete: true,
    missions: portfolio.missions.length,
    promotedSkills: 1,
    typeScriptSemanticTransferVerified: true,
    propertyVerificationPassed: true,
    crossLanguageMigrationVerified: true,
    bestCandidatePreserved: true,
    masterLedger: { assertionVerified: audit.assertionVerified, assertionUnbound: audit.assertionUnbound, externalUnverified: audit.externalUnverified },
    nolane_nativeUnresolved: Number(truth.unresolved),
    generalCodingIntelligenceClaimAllowed: false,
    completeParityClaimAllowed: false,
    comparativeSuperiorityClaimAllowed: false,
  };
  return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
}
