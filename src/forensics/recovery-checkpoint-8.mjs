import { canonicalSha256, deepFreeze } from '../small-model/shared.mjs';

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
  if (canonicalSha256(base) !== receiptSha256) throw new Error(`${label} hash receipt mismatch`);
  return value;
}
function verifyMission(mission, label) {
  verifyReceipt(mission, label);
  if (!Array.isArray(mission.steps) || mission.steps.length < 3) throw new Error(`${label} mission steps are incomplete`);
  for (const [index, step] of mission.steps.entries()) verifyReceipt(step, `${label} step ${index}`);
  if (mission.bestCandidatePreserved !== true || mission.hiddenChainOfThoughtStored !== false) throw new Error(`${label} best candidate or public-state evidence is invalid`);
  if (mission.schema === 'nolane.small-model.ast-recovery-mission.v1') {
    if (mission.status !== 'verified-recovery' || mission.trackedSourceUnchanged !== true || mission.workspaceRemoved !== true || mission.shellUsed !== false) throw new Error(`${label} AST recovery evidence is invalid`);
  } else if (mission.schema === 'nolane.small-model.checkpoint-8-portfolio-mission.v1') {
    verifyReceipt(mission.processReward, `${label} process reward`);
    if (mission.status !== 'verified' || Number(mission.processReward?.reward ?? 0) <= 0) throw new Error(`${label} constraint mission evidence is invalid`);
  } else throw new Error(`${label} mission schema is unsupported`);
  return mission;
}
function verifyClaims(claims) {
  const value = object(claims, 'Protected claims');
  for (const claim of PROTECTED) if (value[claim] !== false) throw new Error(`Protected claim must remain false: ${claim}`);
  return value;
}

export function verifyForensicRecoveryCheckpoint8(input = {}) {
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

  const portfolio = verifyReceipt(input.portfolio, 'Checkpoint 8 portfolio');
  if (portfolio.schema !== 'nolane.small-model.checkpoint-8-mission-portfolio.v1' || !Array.isArray(portfolio.missions) || portfolio.missions.length !== 5) throw new Error('Checkpoint 8 portfolio must contain five missions');
  portfolio.missions.forEach((mission, index) => verifyMission(mission, `Checkpoint 8 mission ${index}`));
  if (portfolio.bestCandidatePreserved !== true || portfolio.hiddenChainOfThoughtStored !== false || Number(portfolio.processValue) <= 0) throw new Error('Checkpoint 8 portfolio process evidence is invalid');

  const transfer = verifyReceipt(portfolio.astTransfer, 'AST transfer');
  if (transfer.schema !== 'nolane.small-model.ast-skill-transfer.v1' || transfer.status !== 'pass' || transfer.repositoryDisjoint !== true || transfer.rollbackRestoredMutationHash !== true || transfer.trackedSourceUnchanged !== true || transfer.bestCandidatePreserved !== true || transfer.hiddenChainOfThoughtStored !== false || Number(transfer.changedTokens) < 1) throw new Error('AST transfer must be disjoint, reversible, and verified');
  verifyMission(transfer.mission, 'AST transfer mission');
  if (transfer.missionReceiptSha256 !== transfer.mission.receiptSha256) throw new Error('AST transfer mission lineage mismatch');

  const smt = verifyReceipt(portfolio.smtProof, 'SMT proof');
  if (smt.schema !== 'nolane.small-model.constraint-proof-verification.v1' || smt.kind !== 'finite-domain-smt' || smt.status !== 'pass' || smt.completeWithinBudgets !== true || smt.hiddenChainOfThoughtStored !== false) throw new Error('SMT proof verification is invalid');
  if (smt.sat?.status !== 'sat' || smt.sat?.completeWithinFiniteDomain !== true || !SHA256.test(String(smt.sat?.proofSha256 ?? ''))) throw new Error('SMT SAT proof is invalid');
  if (smt.unsat?.status !== 'unsat' || smt.unsat?.model !== null || smt.unsat?.completeWithinFiniteDomain !== true || !SHA256.test(String(smt.unsat?.proofSha256 ?? ''))) throw new Error('SMT UNSAT proof is invalid');

  const datalog = verifyReceipt(portfolio.datalogProof, 'Datalog proof');
  if (datalog.schema !== 'nolane.small-model.constraint-proof-verification.v1' || datalog.kind !== 'bounded-datalog' || datalog.status !== 'pass' || datalog.completeWithinBudgets !== true || datalog.unsafeProbeRejected !== true || datalog.hiddenChainOfThoughtStored !== false) throw new Error('Datalog proof verification is invalid');
  if (datalog.datalog?.converged !== true || datalog.datalog?.completeWithinBudgets !== true || !Array.isArray(datalog.datalog?.answers) || datalog.datalog.answers.length < 1) throw new Error('Datalog proof did not converge with an answer');
  verifyReceipt(datalog.datalog, 'Datalog proof result');

  const bundle = verifyReceipt(input.evidenceBundle, 'Checkpoint 8 evidence bundle');
  const proofReceipts = Array.isArray(bundle.constraintProofReceiptSha256) ? bundle.constraintProofReceiptSha256 : [];
  verifyReceipt(bundle.process, 'Checkpoint 8 process evidence');
  verifyReceipt(bundle.cost, 'Checkpoint 8 cost evidence');
  if (bundle.schema !== 'nolane.small-model.checkpoint-8-evidence-bundle.v1' || bundle.allowed !== true || bundle.portfolioReceiptSha256 !== portfolio.receiptSha256 || bundle.astTransferReceiptSha256 !== transfer.receiptSha256 || !proofReceipts.includes(smt.receiptSha256) || !proofReceipts.includes(datalog.receiptSha256) || bundle.process?.allowed !== true || bundle.cost?.allowed !== true || bundle.cost?.candidateCostLower !== true || !(Number(bundle.cost?.totalCostRatio) < 1) || bundle.safety?.noRegression !== true) throw new Error('Checkpoint 8 evidence bundle is invalid');
  if (bundle.claims?.generalCodingIntelligence !== false || bundle.claims?.competitorSuperiority !== false) throw new Error('Checkpoint 8 evidence non-claims must remain locked');

  const promotion = verifyReceipt(input.promotion, 'Checkpoint 8 suite promotion');
  if (promotion.schema !== 'nolane.small-model.checkpoint-8-suite-promotion.v1' || promotion.bundleReceiptSha256 !== bundle.receiptSha256 || !String(promotion.approvedBy ?? '').trim() || !Array.isArray(promotion.promotions) || promotion.promotions.length !== 3) throw new Error('Checkpoint 8 suite promotion is invalid');
  for (const item of promotion.promotions) {
    if (item.schema !== 'nolane.small-model.skill-promotion.v4') throw new Error('Promotion v4 evidence is required');
    verifyReceipt(item, `${item.skillId ?? 'skill'} promotion v4`);
    if (item.status !== 'promoted' || item.governance !== 'solver-transfer-proof-process-cost-required' || item.evidenceBundleReceiptSha256 !== bundle.receiptSha256 || !String(item.approvedBy ?? '').trim()) throw new Error('Promotion v4 evidence is required');
  }
  if (promotion.status?.ready !== true || Object.keys(promotion.status?.active ?? {}).length !== 3) throw new Error('Checkpoint 8 promotion status is not ready');

  const safe = verifyReceipt(input.safeExecution, 'Safe AST execution');
  if (safe.schema !== 'nolane.small-model.checkpoint-8-ast-execution.v1' || Number(safe.changedTokens) < 1 || safe.parse?.valid !== true || safe.executedSource !== false || safe.shellUsed !== false || safe.hiddenChainOfThoughtStored !== false) throw new Error('Safe checkpoint 8 AST execution is invalid');

  const unsafe = verifyReceipt(input.unsafeExecution, 'Unsafe execution');
  if (unsafe.schema !== 'nolane.small-model.checkpoint-8-unsafe-execution.v1' || unsafe.status !== 'blocked' || unsafe.allowed !== false || unsafe.requiresApproval !== true) throw new Error('Unsafe checkpoint 8 execution must remain blocked');
  if (unsafe.claims?.generalCodingIntelligence !== false || unsafe.claims?.competitorSuperiority !== false) throw new Error('Unsafe execution non-claims must remain locked');

  verifyClaims(input.claims);

  const base = {
    schema: 'nolane.forensics.recovery-checkpoint-8-verification.v1',
    status: 'pass',
    localAssertionEvidenceComplete: true,
    missions: portfolio.missions.length,
    promotedSkills: promotion.promotions.length,
    astTransferVerified: true,
    constraintProofsVerified: true,
    bestCandidatePreserved: true,
    masterLedger: { assertionVerified: audit.assertionVerified, assertionUnbound: audit.assertionUnbound, externalUnverified: audit.externalUnverified },
    nolane_nativeUnresolved: Number(truth.unresolved),
    generalCodingIntelligenceClaimAllowed: false,
    completeParityClaimAllowed: false,
    comparativeSuperiorityClaimAllowed: false,
  };
  return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
}
