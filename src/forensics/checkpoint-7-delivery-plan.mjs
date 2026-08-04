const SPECIALISTS = ['tool-router', 'context-scorer', 'test-selector', 'patch-ranker', 'risk-classifier'];

export function createCheckpoint7DeliveryPlan() {
  const prefix = 'NolaneAgent-5.0.0-beta.6-forensic-recovery-checkpoint.7';
  const outputSuffixes = [
    'source.zip', 'change-set.patch', 'change-set.zip', 'release-evidence.zip',
    'CHECKPOINT.md', 'CHECKPOINT.json', 'VERIFICATION-REPORT.md',
    'full-release-matrix.md', 'full-release-matrix.json',
    'assertion-evidence-baseline.json', 'master-ledger-assertion-audit.json',
    'mission-collection.json', 'process-reward-model.json', 'process-reward-benchmark.json', 'process-reward-ablation.json',
    'verified-skill.json', 'skill-transfer.json', 'checkpoint-7-pipeline-evidence.json',
    'safe-decision-support.json', 'unsafe-decision-support.json',
    'delivery-manifest.json', 'SHA256SUMS.txt',
  ];
  const evidenceFiles = [
    'requirements/forensic-source-custody.json',
    'requirements/nolane-symbol-surface-inventory-summary.json',
    'requirements/nolane-symbol-surface-inventory.jsonl',
    'requirements/nolane-native-function-parity-summary.json',
    'requirements/nolane-native-function-parity-ledger.jsonl',
    'requirements/assertion-evidence-bindings.jsonl',
    'requirements/master-ledger-assertion-audit.jsonl',
    'docs/checkpoints/ASSERTION-EVIDENCE-BINDING-BASELINE.json',
    'docs/checkpoints/MASTER-LEDGER-ASSERTION-AUDIT.json',
    'datasets/trajectories/checkpoint-7-v1/mission-collection.json',
    'models/process-reward-checkpoint-7/model.json',
    'models/process-reward-checkpoint-7/benchmark.json',
    'models/process-reward-checkpoint-7/dataset-receipt.json',
    'models/process-reward-checkpoint-7/ablation.json',
    'models/checkpoint-7/verified-skill.json',
    'models/checkpoint-7/skill-transfer.json',
    'models/checkpoint-7/pipeline-evidence.json',
    ...SPECIALISTS.flatMap((specialist) => [`models/checkpoint-7/evidence-bundle-${specialist}.json`]),
    'docs/superpowers/specs/2026-08-02-forensic-recovery-checkpoint-7-design.md',
    'docs/superpowers/plans/2026-08-02-forensic-recovery-checkpoint-7.md',
    'docs/checkpoints/NOLANE-FORENSIC-RECOVERY-CHECKPOINT-7.md',
    'docs/checkpoints/NOLANE-FORENSIC-RECOVERY-CHECKPOINT-7.json',
  ];
  return Object.freeze({
    prefix,
    baselineCommit: '71274e1c9d729070c80a59fb0e9b33acc466d9e7',
    planPath: 'docs/superpowers/plans/2026-08-02-forensic-recovery-checkpoint-7.md',
    outputSuffixes: Object.freeze(outputSuffixes),
    evidenceFiles: Object.freeze(evidenceFiles),
    specialists: Object.freeze([...SPECIALISTS]),
  });
}

export function createCheckpoint7VerificationReport({ gitHead, baselineCommit, checkpoint, matrix }) {
  const audit = checkpoint?.masterLedgerAssertionAudit?.summary;
  const pipeline = checkpoint?.checkpoint7Pipeline;
  if (!audit || !pipeline?.missionCollection || !pipeline?.processVerification || !pipeline?.skillTransfer || !pipeline?.promotion) throw new TypeError('Checkpoint 7 report requires audit mission process skill and promotion evidence');
  return `# Nolane Agent Forensic Recovery Checkpoint 7 Verification Report

- Delivery commit: \`${gitHead}\`
- Checkpoint 6 baseline: \`${baselineCommit}\`
- Checkpoint status: **${checkpoint.verification.status}**
- Full Release Matrix: **${matrix.requiredPassed}/${matrix.requiredTotal} required gates ${matrix.status}**
- Matrix receipt: \`${matrix.receiptSha256}\`
- Master Ledger dispositions: ${audit.assertionVerified} verified, ${audit.assertionUnbound} unbound, ${audit.externalUnverified} external-unverified
- Held-out mission trajectories: **${pipeline.missionCollection.primaryMissions.length} primary and ${pipeline.missionCollection.inductionMissions.length} induction**
- Mission collection receipt: \`${pipeline.missionCollection.receiptSha256}\`
- Process reward verification: \`${pipeline.processVerification.receiptSha256}\`
- Skill transfer verification: \`${pipeline.skillTransfer.receiptSha256}\`
- Promotion v3 specialists: **${pipeline.promotion.specialistPromotions.length}/5**
- Suite promotion receipt: \`${pipeline.promotion.receiptSha256}\`
- Safe decision receipt: \`${pipeline.safeDecisionReceipt.receiptSha256}\`
- Unsafe decision receipt: \`${pipeline.unsafeDecisionReceipt.receiptSha256}\`
- NolaneNative unresolved truth records: ${checkpoint.truthLedger.unresolved}

## Non-claims

General coding intelligence, small-model superintelligence, complete NolaneNative parity, comparative superiority, provider-real certification, and Windows external certification remain unverified.
`;
}
