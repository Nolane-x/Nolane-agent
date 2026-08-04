import { canonicalSha256, deepFreeze } from '../small-model/shared.mjs';
import { loadModelArtifact } from '../small-model/model-artifact.mjs';
import { CHECKPOINT_6_SPECIALISTS } from '../small-model/checkpoint-6-specialist-dataset.mjs';

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
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} is required`);
  return value;
}
function hash(value, label) {
  if (!SHA256.test(String(value ?? ''))) throw new Error(`${label} receipt is invalid`);
  return value;
}
function verifyReceipt(value, label) {
  const { receiptSha256, ...base } = object(value, label);
  hash(receiptSha256, label);
  if (canonicalSha256(base) !== receiptSha256) throw new Error(`${label} receipt mismatch`);
  return value;
}
function verifyMission(mission, label) {
  verifyReceipt(mission, label);
  if (mission.schema !== 'nolane.small-model.mission-trajectory.v1' || mission.status !== 'verified-recovery') throw new Error(`${label} is not a verified mission`);
  if (!Array.isArray(mission.steps) || mission.steps.length < 7 || Number(mission.stepCount) < 7) throw new Error(`${label} mission step coverage is incomplete`);
  for (const [index, step] of mission.steps.entries()) verifyReceipt(step, `${label} step ${index}`);
  if (mission.bestCandidatePreserved !== true || mission.trackedSourceUnchanged !== true || mission.workspaceRemoved !== true) throw new Error(`${label} best candidate or source preservation is invalid`);
  if (mission.trainingRepositoryDisjoint !== true || mission.hiddenChainOfThoughtStored !== false) throw new Error(`${label} is not repository-disjoint public evidence`);
  return mission;
}
function verifyPreparedBundle(preparation, collection) {
  object(preparation, 'Checkpoint 7 preparation');
  const base = {
    schema: preparation.schema,
    collectionReceiptSha256: preparation.collectionReceiptSha256,
    specialists: preparation.specialists,
    specialistSuiteReceiptSha256: preparation.specialistSuiteReceiptSha256,
    processArtifactSha256: preparation.processArtifactSha256,
    processVerificationReceiptSha256: preparation.processVerificationReceiptSha256,
    skillReceiptSha256: preparation.skillReceiptSha256,
    skillTransferReceiptSha256: preparation.skillTransferReceiptSha256,
    evidenceBundleReceiptSha256BySpecialist: preparation.evidenceBundleReceiptSha256BySpecialist,
    status: preparation.status,
    claims: preparation.claims,
  };
  hash(preparation.bundleReceiptSha256, 'Checkpoint 7 bundle');
  if (canonicalSha256(base) !== preparation.bundleReceiptSha256) throw new Error('Checkpoint 7 bundle receipt mismatch');
  if (preparation.schema !== 'nolane.small-model.checkpoint-7-pending-bundle.v1' || preparation.status !== 'pending-approval') throw new Error('Checkpoint 7 preparation must remain pending approval');
  if (preparation.collectionReceiptSha256 !== collection.receiptSha256) throw new Error('Checkpoint 7 collection lineage mismatch');
  if (!Array.isArray(preparation.specialists) || preparation.specialists.length !== CHECKPOINT_6_SPECIALISTS.length) throw new Error('Checkpoint 7 specialist preparation is incomplete');
  return preparation;
}

export function verifyForensicRecoveryCheckpoint7(input = {}) {
  const custody = object(input.custody, 'Source custody');
  const truthLedger = object(input.truthLedger, 'Truth ledger');
  const assertionBaseline = object(input.assertionBaseline, 'Assertion baseline');
  const masterAudit = object(input.masterAudit, 'Master assertion audit');
  const collection = verifyReceipt(input.missionCollection, 'Checkpoint 7 mission collection');
  const preparation = verifyPreparedBundle(input.preparation, collection);
  const promotion = verifyReceipt(input.promotion, 'Checkpoint 7 suite promotion');
  const processArtifact = loadModelArtifact(input.processArtifact);
  const specialistArtifacts = object(input.specialistArtifacts, 'Checkpoint 7 specialist artifacts');
  const safeDecision = verifyReceipt(input.safeDecisionReceipt, 'Safe checkpoint 7 decision');
  const unsafeDecision = verifyReceipt(input.unsafeDecisionReceipt, 'Unsafe checkpoint 7 decision');
  const claims = object(input.claims, 'Recovery claims');

  if (!custody.records?.some((item) => item.id === 'nolane-native-canonical' && item.status !== 'verified')) throw new Error('Canonical NolaneNative source must remain explicitly unavailable');
  if (truthLedger.completeParityEligible !== false || Number(truthLedger.unresolved) < 1) throw new Error('NolaneNative truth ledger must retain unresolved records');

  const ui = assertionBaseline.coverage?.summary;
  if (!ui || ui.requirementsTotal !== 48 || ui.requirementsBound !== 48 || ui.requirementsUnbound !== 0 || ui.requirementsPositiveBound !== 48 || ui.requirementsNegativeBound !== 48 || ui.overBroadTestFiles !== 0 || assertionBaseline.coverage?.certifiable !== true) throw new Error('UI/Audit assertion bindings are incomplete');
  hash(assertionBaseline.receiptSha256, 'Assertion baseline');
  const audit = object(masterAudit.summary, 'Master assertion audit summary');
  if (audit.requirementsTotal !== 1460 || audit.assertionVerified !== 1372 || audit.assertionUnbound !== 0 || audit.externalUnverified !== 88 || Number(audit.documentationOnlyEntrypoints ?? 0) !== 0) throw new Error('Local assertion evidence must remain complete while external requirements remain unverified');
  hash(masterAudit.receiptSha256, 'Master assertion audit');

  if (collection.schema !== 'nolane.small-model.checkpoint-7-mission-collection.v1' || collection.hiddenChainOfThoughtStored !== false) throw new Error('Checkpoint 7 mission collection is invalid');
  if (!Array.isArray(collection.primaryMissions) || collection.primaryMissions.length !== 3 || !Array.isArray(collection.inductionMissions) || collection.inductionMissions.length !== 2) throw new Error('Checkpoint 7 mission collection requires three primary and two induction missions');
  const primary = collection.primaryMissions.map((mission, index) => verifyMission(mission, `Primary mission ${index}`));
  const induction = collection.inductionMissions.map((mission, index) => verifyMission(mission, `Induction mission ${index}`));
  if (new Set(primary.map((mission) => mission.repositoryId)).size !== 3 || new Set(primary.map((mission) => mission.runtime)).size !== 3) throw new Error('Checkpoint 7 primary missions must cover three disjoint repositories and runtimes');
  if (new Set(induction.map((mission) => mission.receiptSha256)).size !== 2) throw new Error('Checkpoint 7 induction missions require distinct receipts');

  const processVerification = verifyReceipt(preparation.processVerification, 'Process reward verification');
  if (processArtifact.specialist !== 'process-reward' || processVerification.schema !== 'nolane.small-model.process-reward-verification.v1' || processVerification.status !== 'pass' || processVerification.artifactSha256 !== processArtifact.artifactSha256) throw new Error('Checkpoint 7 process reward evidence is invalid');
  if (!processArtifact.model.weights.flat().some((value) => Math.abs(Number(value)) > 0)) throw new Error('Process reward artifact must contain trained weights');
  const processLoss = processArtifact.model.training?.lossHistory;
  if (!Array.isArray(processLoss) || processLoss.length < 2 || !(Number(processLoss.at(-1)) < Number(processLoss[0]))) throw new Error('Process reward artifact must show loss reduction');
  if (Number(processVerification.heldOutAccuracy) < 0.8 || Number(processVerification.lift) < 0.1) throw new Error('Process reward held-out or ablation evidence is insufficient');

  const skill = verifyReceipt(preparation.skill, 'Verified skill');
  const skillTransfer = verifyReceipt(preparation.skillTransfer, 'Skill transfer');
  if (skill.schema !== 'nolane.small-model.verified-skill.v1' || skill.hiddenChainOfThoughtStored !== false || !Array.isArray(skill.inductionReceiptSha256) || skill.inductionReceiptSha256.length !== 2) throw new Error('Checkpoint 7 verified skill evidence is invalid');
  if (skillTransfer.schema !== 'nolane.small-model.skill-transfer-verification.v1' || skillTransfer.status !== 'pass' || skillTransfer.repositoryDisjoint !== true || skillTransfer.testPassed !== true || skillTransfer.rollbackRestoredInputHash !== true || skillTransfer.trackedSourceUnchanged !== true || skillTransfer.workspaceRemoved !== true) throw new Error('Checkpoint 7 skill transfer evidence is invalid');
  if (skillTransfer.skillReceiptSha256 !== skill.receiptSha256) throw new Error('Checkpoint 7 skill transfer lineage mismatch');

  if (promotion.schema !== 'nolane.small-model.checkpoint-7-suite-promotion.v1' || promotion.bundleReceiptSha256 !== preparation.bundleReceiptSha256 || !String(promotion.approvedBy ?? '').trim()) throw new Error('Checkpoint 7 suite promotion is invalid');
  if (promotion.processPromotion?.schema !== 'nolane.small-model.artifact-promotion.v2' || promotion.processPromotion.artifactSha256 !== processArtifact.artifactSha256) throw new Error('Checkpoint 7 process promotion v2 is required');
  verifyReceipt(promotion.processPromotion, 'Process reward promotion');
  if (!Array.isArray(promotion.specialistPromotions) || promotion.specialistPromotions.length !== CHECKPOINT_6_SPECIALISTS.length) throw new Error('Checkpoint 7 promotion v3 specialist count is incomplete');

  const specialistSummary = [];
  for (const specialist of CHECKPOINT_6_SPECIALISTS) {
    const artifact = loadModelArtifact(specialistArtifacts[specialist]);
    if (artifact.specialist !== specialist) throw new Error(`${specialist} checkpoint 7 artifact identity mismatch`);
    if (!artifact.model.weights.flat().some((value) => Math.abs(Number(value)) > 0)) throw new Error(`${specialist} artifact must contain trained weights`);
    const evidence = verifyReceipt(preparation.evidenceBundles?.[specialist], `${specialist} checkpoint 7 evidence bundle`);
    if (evidence.schema !== 'nolane.small-model.checkpoint-7-evidence-bundle.v1' || evidence.artifactSha256 !== artifact.artifactSha256 || evidence.claims?.generalCodingIntelligence !== false || evidence.claims?.competitorSuperiority !== false) throw new Error(`${specialist} checkpoint 7 evidence bundle is invalid`);
    for (const [key, schema] of [['transfer', 'nolane.small-model.checkpoint-7-transfer-evidence.v1'], ['process', 'nolane.small-model.checkpoint-7-process-evidence.v1'], ['cost', 'nolane.small-model.checkpoint-7-cost-evidence.v1']]) {
      const nested = verifyReceipt(evidence[key], `${specialist} ${key} evidence`);
      if (nested.schema !== schema || nested.artifactSha256 !== artifact.artifactSha256 || nested.allowed !== true) throw new Error(`${specialist} ${key} evidence is invalid`);
    }
    if (evidence.transfer.repositoryDisjoint !== true || Number(evidence.transfer.candidateSuccessRate) <= Number(evidence.transfer.baselineSuccessRate)) throw new Error(`${specialist} transfer evidence must be positive and disjoint`);
    if (Number(evidence.process.delta) <= 0) throw new Error(`${specialist} process evidence must be positive`);
    if (evidence.cost.candidateCostLower !== true || !(Number(evidence.cost.totalCostRatio) < 1)) throw new Error(`${specialist} cost evidence must be lower at matched quality`);
    if (evidence.safety?.noRegression !== true) throw new Error(`${specialist} safety evidence regressed`);
    const promoted = promotion.specialistPromotions.find((item) => item.specialist === specialist);
    verifyReceipt(promoted, `${specialist} promotion v3`);
    if (promoted.schema !== 'nolane.small-model.artifact-promotion.v3' || promoted.governance !== 'transfer-process-cost-required' || promoted.artifactSha256 !== artifact.artifactSha256 || promoted.evidenceBundleReceiptSha256 !== evidence.receiptSha256) throw new Error(`${specialist} transfer-governed promotion v3 is required`);
    specialistSummary.push({ specialist, artifactSha256: artifact.artifactSha256, evidenceBundleReceiptSha256: evidence.receiptSha256, promotionReceiptSha256: promoted.receiptSha256 });
  }

  if (safeDecision.schema !== 'nolane.small-model.checkpoint-7-decision-support.v1' || safeDecision.status !== 'allow' || safeDecision.allowed !== true || safeDecision.requiresApproval !== false || safeDecision.process?.action !== 'progress') throw new Error('Safe checkpoint 7 progress decision receipt is required');
  if (unsafeDecision.schema !== 'nolane.small-model.checkpoint-7-decision-support.v1' || unsafeDecision.status !== 'blocked' || unsafeDecision.allowed !== false || unsafeDecision.requiresApproval !== true || unsafeDecision.process?.action !== 'regression') throw new Error('Unsafe checkpoint 7 regression decision must remain blocked');
  for (const decision of [safeDecision, unsafeDecision]) if (decision.claims?.generalCodingIntelligence !== false || decision.claims?.frontierParity !== false || decision.claims?.competitorSuperiority !== false) throw new Error('Checkpoint 7 decision non-claims must remain locked');
  for (const claim of PROTECTED) if (claims[claim] !== false) throw new Error(`Protected claim must remain false: ${claim}`);

  const base = {
    schema: 'nolane.forensics.recovery-checkpoint-7-verification.v1', status: 'pass',
    localAssertionEvidenceComplete: true,
    missions: { primary: primary.length, induction: induction.length, repositories: [...new Set(primary.map((mission) => mission.repositoryId))].sort(), runtimes: [...new Set(primary.map((mission) => mission.runtime))].sort(), bestCandidatePreserved: true },
    processRewardVerified: true, skillTransferVerified: true, transferProcessCostPromotionVerified: true,
    specialists: specialistSummary,
    masterLedger: { assertionVerified: audit.assertionVerified, assertionUnbound: audit.assertionUnbound, externalUnverified: audit.externalUnverified },
    nolane_nativeUnresolved: Number(truthLedger.unresolved),
    generalCodingIntelligenceClaimAllowed: false, completeParityClaimAllowed: false, comparativeSuperiorityClaimAllowed: false,
  };
  return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
}
