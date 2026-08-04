import { canonicalSha256, deepFreeze } from '../small-model/shared.mjs';
import { verifySolverPropertyReceipt } from '../small-model/solver-property-verifier.mjs';

const SHA256 = /^[a-f0-9]{64}$/;
const PROTECTED = Object.freeze([
  'completeParityClaimAllowed',
  'comparativeSuperiorityClaimAllowed',
  'windowsUiCertified',
  'providerRealCertified',
  'smallModelSuperintelligenceImplemented',
  'allOriginalGoalsComplete',
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
function verifyMission(mission, label) {
  verifyReceipt(mission, label);
  if (!Array.isArray(mission.steps) || mission.steps.length < 1) throw new Error(`${label} steps are incomplete`);
  for (const [index, step] of mission.steps.entries()) verifyReceipt(step, `${label} step ${index}`);
  if (mission.bestCandidatePreserved !== true || mission.hiddenChainOfThoughtStored !== false) throw new Error(`${label} candidate preservation or public-state evidence is invalid`);
  if (mission.schema === 'nolane.small-model.multi-file-refactor-mission.v1') {
    if (mission.status !== 'verified-recovery' || mission.rollbackRestoredAllHashes !== true || mission.trackedSourcesUnchanged !== true || mission.workspaceRemoved !== true || mission.shellUsed !== false || Number(mission.changedFiles) < 3) throw new Error(`${label} multi-file refactor evidence is invalid`);
  } else if (mission.schema === 'nolane.small-model.checkpoint-9-property-mission.v1') {
    verifyReceipt(mission.processReward, `${label} process reward`);
    if (mission.status !== 'verified' || Number(mission.processReward.reward ?? 0) <= 0) throw new Error(`${label} property mission evidence is invalid`);
  } else throw new Error(`${label} mission schema is unsupported`);
  return mission;
}

export function verifyForensicRecoveryCheckpoint9(input = {}) {
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

  const portfolio = verifyReceipt(input.portfolio, 'Checkpoint 9 portfolio');
  if (portfolio.schema !== 'nolane.small-model.checkpoint-9-mission-portfolio.v1' || portfolio.status !== 'verified' || !Array.isArray(portfolio.missions) || portfolio.missions.length !== 5) throw new Error('Checkpoint 9 portfolio must contain five verified missions');
  portfolio.missions.forEach((mission, index) => verifyMission(mission, `Checkpoint 9 mission ${index}`));
  if (portfolio.bestCandidatePreserved !== true || portfolio.hiddenChainOfThoughtStored !== false || Number(portfolio.processValue) <= 0) throw new Error('Checkpoint 9 process evidence is invalid');

  const transfer = verifyReceipt(portfolio.refactorTransfer, 'Checkpoint 9 refactor transfer');
  if (transfer.schema !== 'nolane.small-model.checkpoint-9-refactor-transfer.v1' || transfer.status !== 'pass' || transfer.repositoryDisjoint !== true || transfer.changedFiles < 3 || transfer.rollbackRestoredAllHashes !== true || transfer.trackedSourcesUnchanged !== true || transfer.bestCandidatePreserved !== true || transfer.commentPreserved !== true || transfer.stringPreserved !== true || transfer.propertyKeysPreserved !== true || transfer.hiddenChainOfThoughtStored !== false) throw new Error('Checkpoint 9 multi-file transfer evidence is invalid');
  verifyMission(transfer.mission, 'Checkpoint 9 transfer mission');
  if (transfer.missionReceiptSha256 !== transfer.mission.receiptSha256) throw new Error('Checkpoint 9 transfer mission lineage mismatch');

  const smt = verifySolverPropertyReceipt(portfolio.smtProperties);
  const datalog = verifySolverPropertyReceipt(portfolio.datalogProperties);
  if (smt.trials < 20 || smt.satCases < 1 || smt.unsatCases < 1 || smt.counterexamples.length !== 0) throw new Error('Checkpoint 9 SMT property evidence is insufficient');
  if (datalog.trials < 15 || datalog.convergedCases !== datalog.trials || datalog.counterexamples.length !== 0) throw new Error('Checkpoint 9 Datalog property evidence is insufficient');

  const bundle = verifyReceipt(input.evidenceBundle, 'Checkpoint 9 evidence bundle');
  verifyReceipt(bundle.process, 'Checkpoint 9 process evidence');
  verifyReceipt(bundle.cost, 'Checkpoint 9 cost evidence');
  if (bundle.schema !== 'nolane.small-model.checkpoint-9-evidence-bundle.v1' || bundle.allowed !== true || bundle.portfolioReceiptSha256 !== portfolio.receiptSha256 || bundle.refactorSkillReceiptSha256 !== portfolio.refactorSkill.receiptSha256 || bundle.refactorTransferReceiptSha256 !== transfer.receiptSha256 || !Array.isArray(bundle.propertyReceiptSha256) || !bundle.propertyReceiptSha256.includes(smt.receiptSha256) || !bundle.propertyReceiptSha256.includes(datalog.receiptSha256) || bundle.process.allowed !== true || bundle.cost.allowed !== true || bundle.cost.candidateCostLower !== true || !(Number(bundle.cost.totalCostRatio) < 1) || bundle.safety?.noRegression !== true) throw new Error('Checkpoint 9 evidence bundle is invalid');
  if (bundle.claims?.generalCodingIntelligence !== false || bundle.claims?.competitorSuperiority !== false || bundle.claims?.frontierParity !== false || bundle.claims?.externalRepositoryGeneralization !== false) throw new Error('Checkpoint 9 evidence non-claims must remain locked');

  const promotion = verifyReceipt(input.promotion, 'Checkpoint 9 suite promotion');
  if (promotion.schema !== 'nolane.small-model.checkpoint-9-suite-promotion.v1' || promotion.bundleReceiptSha256 !== bundle.receiptSha256 || !String(promotion.approvedBy ?? '').trim() || promotion.status?.ready !== true) throw new Error('Checkpoint 9 suite promotion is invalid');
  const item = verifyReceipt(promotion.promotion, 'Checkpoint 9 promotion v5');
  if (item.schema !== 'nolane.small-model.skill-promotion.v5' || item.status !== 'promoted' || item.governance !== 'multi-file-transfer-property-process-cost-required' || item.evidenceBundleReceiptSha256 !== bundle.receiptSha256 || !String(item.approvedBy ?? '').trim()) throw new Error('Promotion v5 evidence is required');

  const safe = verifyReceipt(input.safeExecution, 'Checkpoint 9 safe execution');
  if (safe.schema !== 'nolane.small-model.checkpoint-9-refactor-execution.v1' || Number(safe.changedFiles) < 3 || Number(safe.changedTokens) < 3 || safe.executedSource !== false || safe.shellUsed !== false || safe.hiddenChainOfThoughtStored !== false) throw new Error('Checkpoint 9 safe execution is invalid');

  const unsafe = verifyReceipt(input.unsafeExecution, 'Checkpoint 9 unsafe execution');
  if (unsafe.schema !== 'nolane.small-model.checkpoint-9-unsafe-execution.v1' || unsafe.status !== 'blocked' || unsafe.allowed !== false || unsafe.requiresApproval !== true || unsafe.hiddenChainOfThoughtStored !== false) throw new Error('Checkpoint 9 unsafe execution must remain blocked');

  verifyClaims(input.claims);

  const base = {
    schema: 'nolane.forensics.recovery-checkpoint-9-verification.v1',
    status: 'pass',
    localAssertionEvidenceComplete: true,
    missions: portfolio.missions.length,
    promotedSkills: 1,
    multiFileTransferVerified: true,
    propertyVerificationPassed: true,
    bestCandidatePreserved: true,
    masterLedger: { assertionVerified: audit.assertionVerified, assertionUnbound: audit.assertionUnbound, externalUnverified: audit.externalUnverified },
    nolane_nativeUnresolved: Number(truth.unresolved),
    generalCodingIntelligenceClaimAllowed: false,
    completeParityClaimAllowed: false,
    comparativeSuperiorityClaimAllowed: false,
  };
  return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
}
