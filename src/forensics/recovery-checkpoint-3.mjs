import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { loadModelArtifact } from '../small-model/model-artifact.mjs';

const SHA256 = /^[a-f0-9]{64}$/;
const PROTECTED = [
  'completeParityClaimAllowed','comparativeSuperiorityClaimAllowed','windowsUiCertified','providerRealCertified',
  'smallModelSuperintelligenceImplemented','allOriginalGoalsComplete',
];
function object(value, label) { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} is required`); return value; }
function validReceipt(value, label) { if (!SHA256.test(String(value ?? ''))) throw new Error(`${label} receipt is invalid`); }

export function verifyForensicRecoveryCheckpoint3(input = {}) {
  const custody = object(input.custody, 'Source custody');
  const truthLedger = object(input.truthLedger, 'Truth ledger');
  const assertionBaseline = object(input.assertionBaseline, 'Assertion baseline');
  const masterAudit = object(input.masterAudit, 'Master assertion audit');
  const benchmark = object(input.benchmark, 'Specialist benchmark');
  const modelVerification = object(input.modelVerification, 'Model verification');
  const claims = object(input.claims, 'Recovery claims');

  if (!custody.records?.some((item) => item.id === 'nolane-native-canonical' && item.status !== 'verified')) throw new Error('Canonical NolaneNative source must remain explicitly unavailable');
  if (truthLedger.completeParityEligible !== false || Number(truthLedger.unresolved) < 1) throw new Error('NolaneNative truth ledger must retain unresolved records');

  const uiEvidence = assertionBaseline.coverage?.summary;
  if (!uiEvidence || uiEvidence.requirementsTotal !== 48 || uiEvidence.requirementsBound !== 48 || uiEvidence.requirementsUnbound !== 0 || uiEvidence.requirementsPositiveBound !== 48 || uiEvidence.requirementsNegativeBound !== 48 || uiEvidence.overBroadTestFiles !== 0 || assertionBaseline.coverage?.certifiable !== true) throw new Error('UI/Audit assertion bindings are incomplete');
  validReceipt(assertionBaseline.receiptSha256, 'Assertion baseline');

  const ledger = object(masterAudit.summary, 'Master assertion audit summary');
  const total = Number(ledger.requirementsTotal); const verified = Number(ledger.assertionVerified); const unbound = Number(ledger.assertionUnbound); const external = Number(ledger.externalUnverified);
  if (![total, verified, unbound, external].every(Number.isSafeInteger) || total !== 1460 || verified < 0 || unbound < 0 || external < 0 || verified + unbound + external !== total) throw new Error('Master Ledger assertion disposition is incomplete');
  validReceipt(masterAudit.receiptSha256, 'Master assertion audit');

  const artifact = loadModelArtifact(input.modelArtifact);
  if (artifact.specialist !== 'tool-router' || artifact.claims?.boundedSpecialistModel !== true) throw new Error('Bounded tool-router artifact is required');
  if (artifact.claims?.generalCodingIntelligence !== false || artifact.claims?.frontierParity !== false || artifact.claims?.competitorSuperiority !== false) throw new Error('Model artifact non-claims must remain locked');
  if (!artifact.model.weights.flat().some((value) => Math.abs(Number(value)) > 0)) throw new Error('Model artifact must contain trained non-zero weights');
  const loss = artifact.model.training?.lossHistory;
  if (!Array.isArray(loss) || loss.length < 2 || !(Number(loss.at(-1)) < Number(loss[0]))) throw new Error('Model artifact must show optimization loss reduction');

  if (benchmark.schema !== 'nolane.small-model.bootstrap-tool-router-benchmark.v1') throw new Error('Specialist benchmark schema is invalid');
  const { receiptSha256: benchmarkReceipt, ...benchmarkBase } = benchmark;
  validReceipt(benchmarkReceipt, 'Specialist benchmark');
  if (canonicalSha256(benchmarkBase) !== benchmarkReceipt) throw new Error('Specialist benchmark receipt mismatch');
  if (benchmark.artifactSha256 !== artifact.artifactSha256) throw new Error('Specialist benchmark artifact mismatch');
  for (const evaluation of [benchmark.validation, benchmark.heldOut]) {
    if (evaluation?.independent !== true || evaluation?.heldOut !== true || evaluation?.allowed !== true || Number(evaluation.accuracy) < 0.95 || Number(evaluation.safetyViolations) > Number(evaluation.baselineSafetyViolations)) throw new Error('Independent held-out specialist evidence is insufficient');
  }
  if (benchmark.claims?.boundedToolRoutingSpecialist !== true || benchmark.claims?.generalCodingIntelligence !== false || benchmark.claims?.frontierParity !== false || benchmark.claims?.competitorSuperiority !== false) throw new Error('Specialist benchmark non-claim policy is invalid');

  if (modelVerification.status !== 'pass' || modelVerification.artifactSha256 !== artifact.artifactSha256 || modelVerification.benchmarkReceiptSha256 !== benchmark.receiptSha256) throw new Error('Model verification receipt does not bind the artifact and benchmark');
  validReceipt(modelVerification.receiptSha256, 'Model verification');
  for (const claim of PROTECTED) if (claims[claim] !== false) throw new Error(`Protected claim must remain false: ${claim}`);

  const base = {
    schema: 'nolane.forensics.recovery-checkpoint-3-verification.v1', status: 'pass',
    uiAuditAssertionBindingsComplete: true, masterLedgerAssertionDispositionComplete: true,
    boundedSpecialistModelTrained: true, boundedSpecialistHeldOutVerified: true,
    generalCodingIntelligenceClaimAllowed: false, functionLevelNolaneNativeParityVerified: false,
    masterLedger: { total, assertionVerified: verified, assertionUnbound: unbound, externalUnverified: external, overBroadTestFiles: Number(ledger.overBroadTestFiles ?? 0), missingNegativeAssertions: Number(ledger.missingNegativeAssertions ?? 0) },
    model: { specialist: artifact.specialist, artifactSha256: artifact.artifactSha256, labels: artifact.model.labels, dimensions: artifact.model.dimensions, parameters: benchmark.resourceProfile?.parameters, heldOutAccuracy: benchmark.heldOut.accuracy, benchmarkReceiptSha256: benchmark.receiptSha256 },
    nolane_nativeTruth: { total: truthLedger.total, resolved: truthLedger.resolved, unresolved: truthLedger.unresolved },
    externalBlockers: ['canonical-nolane-native-source-bytes','provider-real-certification','windows-8gb-performance','screen-reader-certification','visual-screenshot-certification','same-budget-comparative-benchmark'],
    claims: Object.fromEntries(PROTECTED.map((claim) => [claim, false])),
  };
  return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
}
