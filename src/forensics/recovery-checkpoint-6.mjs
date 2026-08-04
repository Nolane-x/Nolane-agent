import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { loadModelArtifact } from '../small-model/model-artifact.mjs';
import { CHECKPOINT_6_SPECIALISTS } from '../small-model/checkpoint-6-specialist-dataset.mjs';

const SHA256 = /^[a-f0-9]{64}$/;
const PROTECTED = ['completeParityClaimAllowed','comparativeSuperiorityClaimAllowed','windowsUiCertified','providerRealCertified','smallModelSuperintelligenceImplemented','allOriginalGoalsComplete'];
function object(value, label) { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} is required`); return value; }
function receipt(value, label) { if (!SHA256.test(String(value ?? ''))) throw new Error(`${label} receipt is invalid`); }
function verifyReceipt(value, label) { const { receiptSha256, ...base } = object(value, label); receipt(receiptSha256, label); if (canonicalSha256(base) !== receiptSha256) throw new Error(`${label} receipt mismatch`); return value; }

export function verifyForensicRecoveryCheckpoint6(input = {}) {
  const custody = object(input.custody, 'Source custody');
  const truthLedger = object(input.truthLedger, 'Truth ledger');
  const assertionBaseline = object(input.assertionBaseline, 'Assertion baseline');
  const masterAudit = object(input.masterAudit, 'Master assertion audit');
  const multiRuntime = verifyReceipt(input.multiRuntime, 'Multi-runtime trajectory dataset');
  const recovery = verifyReceipt(input.recovery, 'Mutation recovery dataset');
  const artifacts = object(input.suiteArtifacts, 'Checkpoint 6 specialist artifacts');
  const benchmarks = object(input.suiteBenchmarks, 'Checkpoint 6 specialist benchmarks');
  const ablations = object(input.suiteAblations, 'Checkpoint 6 specialist ablations');
  const suiteVerification = verifyReceipt(input.suiteVerification, 'Checkpoint 6 specialist suite verification');
  const safeDecision = verifyReceipt(input.safeDecisionReceipt, 'Safe checkpoint 6 decision');
  const unsafeDecision = verifyReceipt(input.unsafeDecisionReceipt, 'Unsafe checkpoint 6 decision');
  const provenance = verifyReceipt(input.thirdPartyProvenance, 'Third-party provenance');
  const claims = object(input.claims, 'Recovery claims');

  if (!custody.records?.some((item) => item.id === 'nolane-native-canonical' && item.status !== 'verified')) throw new Error('Canonical NolaneNative source must remain explicitly unavailable');
  if (truthLedger.completeParityEligible !== false || Number(truthLedger.unresolved) < 1) throw new Error('NolaneNative truth ledger must retain unresolved records');

  const ui = assertionBaseline.coverage?.summary;
  if (!ui || ui.requirementsTotal !== 48 || ui.requirementsBound !== 48 || ui.requirementsUnbound !== 0 || ui.requirementsPositiveBound !== 48 || ui.requirementsNegativeBound !== 48 || ui.overBroadTestFiles !== 0 || assertionBaseline.coverage?.certifiable !== true) throw new Error('UI/Audit assertion bindings are incomplete');
  receipt(assertionBaseline.receiptSha256, 'Assertion baseline');

  const ledger = object(masterAudit.summary, 'Master assertion audit summary');
  const total = Number(ledger.requirementsTotal); const verified = Number(ledger.assertionVerified); const unbound = Number(ledger.assertionUnbound); const external = Number(ledger.externalUnverified);
  if (![total, verified, unbound, external].every(Number.isSafeInteger) || total !== 1460 || verified + unbound + external !== total) throw new Error('Master Ledger assertion disposition is incomplete');
  if (verified !== 1372 || unbound !== 0 || external !== 88 || Number(ledger.documentationOnlyEntrypoints ?? 0) !== 0) throw new Error('Local assertion evidence must be complete while external requirements remain unverified');
  receipt(masterAudit.receiptSha256, 'Master assertion audit');

  if (multiRuntime.schema !== 'nolane.small-model.multi-runtime-trajectory-dataset.v1' || multiRuntime.episodeCount < 7 || multiRuntime.excludedCount !== 0 || multiRuntime.hiddenChainOfThoughtStored !== false || new Set(multiRuntime.runtimes ?? []).size < 3 || new Set(multiRuntime.projects ?? []).size < 5) throw new Error('Multi-runtime trajectory coverage is insufficient');
  if (recovery.schema !== 'nolane.small-model.mutation-recovery-dataset.v1' || recovery.scenarioCount < 3 || recovery.mutationFailures < 3 || recovery.recoveryPasses < 3 || recovery.hiddenChainOfThoughtStored !== false || new Set(recovery.runtimes ?? []).size < 3) throw new Error('Mutation recovery trajectory coverage is insufficient');

  if (suiteVerification.schema !== 'nolane.small-model.checkpoint-6-specialist-suite-verification.v1' || suiteVerification.status !== 'pass') throw new Error('Checkpoint 6 specialist suite verification is invalid');
  const specialistSummary = [];
  for (const specialist of CHECKPOINT_6_SPECIALISTS) {
    const artifact = loadModelArtifact(artifacts[specialist]);
    const benchmark = verifyReceipt(benchmarks[specialist], `${specialist} checkpoint 6 benchmark`);
    const ablation = verifyReceipt(ablations[specialist], `${specialist} checkpoint 6 ablation`);
    if (artifact.specialist !== specialist || benchmark.specialist !== specialist || ablation.specialist !== specialist) throw new Error(`${specialist} checkpoint 6 identity mismatch`);
    if (benchmark.artifactSha256 !== artifact.artifactSha256 || ablation.artifactSha256 !== artifact.artifactSha256 || benchmark.ablationReceiptSha256 !== ablation.receiptSha256) throw new Error(`${specialist} checkpoint 6 binding mismatch`);
    if (!artifact.model.weights.flat().some((value) => Math.abs(Number(value)) > 0)) throw new Error(`${specialist} artifact must contain trained weights`);
    const loss = artifact.model.training?.lossHistory;
    if (!Array.isArray(loss) || loss.length < 2 || !(Number(loss.at(-1)) < Number(loss[0]))) throw new Error(`${specialist} artifact must show loss reduction`);
    if (benchmark.validation?.allowed !== true || benchmark.heldOut?.allowed !== true || benchmark.validation?.accuracy < 0.8 || benchmark.heldOut?.accuracy < 0.8) throw new Error(`${specialist} held-out evidence is insufficient`);
    if (ablation.allowed !== true || Number(ablation.lift) < 0.1 || Number(ablation.model?.safetyViolations) > Number(ablation.baselineEvaluation?.safetyViolations)) throw new Error(`${specialist} ablation evidence is insufficient`);
    const lineage = benchmark.lineage;
    if (Number(lineage?.repositoryEpisodes) < 32 || Number(lineage?.multiRuntimeEpisodes) < 7 || Number(lineage?.recoveryEpisodes) < 6 || new Set(lineage?.runtimes ?? []).size < 3 || new Set(lineage?.projects ?? []).size < 5 || lineage?.mutationObserved !== true || lineage?.recoveryObserved !== true) throw new Error(`${specialist} trajectory lineage is insufficient`);
    if (benchmark.claims?.generalCodingIntelligence !== false || benchmark.claims?.frontierParity !== false || benchmark.claims?.competitorSuperiority !== false || ablation.claims?.generalCodingIntelligence !== false || ablation.claims?.competitorSuperiority !== false) throw new Error(`${specialist} non-claims must remain locked`);
    if (suiteVerification.artifactSha256BySpecialist?.[specialist] !== artifact.artifactSha256 || suiteVerification.benchmarkReceiptSha256BySpecialist?.[specialist] !== benchmark.receiptSha256 || suiteVerification.ablationReceiptSha256BySpecialist?.[specialist] !== ablation.receiptSha256) throw new Error(`${specialist} suite verification binding mismatch`);
    specialistSummary.push({ specialist, artifactSha256: artifact.artifactSha256, heldOutAccuracy: benchmark.heldOut.accuracy, lift: ablation.lift, ablationReceiptSha256: ablation.receiptSha256 });
  }

  if (safeDecision.schema !== 'nolane.small-model.checkpoint-6-decision-support.v1' || safeDecision.status !== 'allow' || safeDecision.allowed !== true || safeDecision.requiresApproval !== false) throw new Error('Safe checkpoint 6 decision receipt is required');
  if (unsafeDecision.schema !== 'nolane.small-model.checkpoint-6-decision-support.v1' || unsafeDecision.status !== 'blocked' || unsafeDecision.allowed !== false || unsafeDecision.requiresApproval !== true) throw new Error('Unsafe checkpoint 6 decision must remain blocked');
  for (const decision of [safeDecision, unsafeDecision]) if (decision.claims?.generalCodingIntelligence !== false || decision.claims?.frontierParity !== false || decision.claims?.competitorSuperiority !== false) throw new Error('Checkpoint 6 decision non-claims must remain locked');

  const provenanceAttribution = provenance.historicalResearchAttribution ?? provenance.nolane_nativeAttribution;
  if (!['nolane.release.third-party-provenance.v1', 'nolane.release.third-party-provenance.v2'].includes(provenance.schema) || provenance.valid !== true || provenanceAttribution?.upstream !== 'Nous Research' || provenanceAttribution?.license !== 'MIT' || provenanceAttribution?.runtimeDistributed !== false || provenanceAttribution?.ownershipClaimed !== false || provenanceAttribution?.cleanRoomTransformation !== true) throw new Error('Third-party provenance is invalid');
  for (const claim of PROTECTED) if (claims[claim] !== false) throw new Error(`Protected claim must remain false: ${claim}`);

  const base = {
    schema: 'nolane.forensics.recovery-checkpoint-6-verification.v1', status: 'pass',
    localAssertionEvidenceComplete: true, multiRuntimeTrajectoryCollectionVerified: true, mutationRecoveryVerified: true, ablationGovernedSpecialistsVerified: true, thirdPartyProvenanceVerified: true,
    generalCodingIntelligenceClaimAllowed: false, functionLevelNolaneNativeParityVerified: false,
    masterLedger: { total, assertionVerified: verified, assertionUnbound: unbound, externalUnverified: external },
    multiRuntimeTrajectories: { episodes: multiRuntime.episodeCount, runtimes: multiRuntime.runtimes, projects: multiRuntime.projects, receiptSha256: multiRuntime.receiptSha256 },
    recoveryTrajectories: { episodes: recovery.episodeCount, scenarios: recovery.scenarioCount, mutationFailures: recovery.mutationFailures, recoveryPasses: recovery.recoveryPasses, receiptSha256: recovery.receiptSha256 },
    specialists: specialistSummary,
    thirdPartyProvenanceReceiptSha256: provenance.receiptSha256,
    nolane_nativeTruth: { total: truthLedger.total, resolved: truthLedger.resolved, unresolved: truthLedger.unresolved },
    externalBlockers: ['canonical-nolane-native-source-bytes','provider-real-certification','windows-8gb-performance','screen-reader-certification','visual-screenshot-certification','same-budget-comparative-benchmark'],
    claims: Object.fromEntries(PROTECTED.map((claim) => [claim, false])),
  };
  return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
}
