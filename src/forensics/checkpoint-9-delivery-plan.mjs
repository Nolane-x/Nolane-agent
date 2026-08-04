export function createCheckpoint9DeliveryPlan() {
  const prefix = 'NolaneAgent-5.0.0-beta.6-forensic-recovery-checkpoint.9';
  return Object.freeze({
    prefix,
    baselineCommit: '73443a7353b7f0bc8bacb75a247ac0c610f73b33',
    planPath: 'docs/superpowers/plans/2026-08-02-forensic-recovery-checkpoint-9.md',
    outputSuffixes: Object.freeze([
      'source.zip', 'change-set.patch', 'change-set.zip', 'release-evidence.zip',
      'CHECKPOINT.md', 'CHECKPOINT.json', 'VERIFICATION-REPORT.md',
      'full-release-matrix.md', 'full-release-matrix.json',
      'assertion-evidence-baseline.json', 'master-ledger-assertion-audit.json',
      'mission-portfolio.json', 'refactor-skill.json', 'refactor-transfer.json',
      'smt-properties.json', 'datalog-properties.json', 'evidence-bundle.json',
      'promotion.json', 'checkpoint-9-pipeline-evidence.json',
      'safe-execution.json', 'unsafe-execution.json', 'delivery-manifest.json', 'SHA256SUMS.txt',
    ]),
    evidenceFiles: Object.freeze([
      'requirements/forensic-source-custody.json',
      'requirements/nolane-symbol-surface-inventory-summary.json',
      'requirements/nolane-symbol-surface-inventory.jsonl',
      'requirements/nolane-native-function-parity-summary.json',
      'requirements/nolane-native-function-parity-ledger.jsonl',
      'requirements/assertion-evidence-bindings.jsonl',
      'requirements/master-ledger-assertion-audit.jsonl',
      'docs/checkpoints/ASSERTION-EVIDENCE-BINDING-BASELINE.json',
      'docs/checkpoints/MASTER-LEDGER-ASSERTION-AUDIT.json',
      'datasets/trajectories/checkpoint-9-v1/mission-portfolio.json',
      'models/checkpoint-9/refactor-skill.json',
      'models/checkpoint-9/refactor-transfer.json',
      'models/checkpoint-9/smt-properties.json',
      'models/checkpoint-9/datalog-properties.json',
      'models/checkpoint-9/evidence-bundle.json',
      'models/checkpoint-9/promotion.json',
      'models/checkpoint-9/safe-execution.json',
      'models/checkpoint-9/unsafe-execution.json',
      'models/checkpoint-9/pipeline-evidence.json',
      'docs/superpowers/specs/2026-08-02-forensic-recovery-checkpoint-9-design.md',
      'docs/superpowers/plans/2026-08-02-forensic-recovery-checkpoint-9.md',
      'docs/checkpoints/NOLANE-FORENSIC-RECOVERY-CHECKPOINT-9.md',
      'docs/checkpoints/NOLANE-FORENSIC-RECOVERY-CHECKPOINT-9.json',
    ]),
  });
}

export function createCheckpoint9VerificationReport({ gitHead, baselineCommit, checkpoint, matrix }) {
  const audit = checkpoint?.masterLedgerAssertionAudit?.summary;
  const pipeline = checkpoint?.checkpoint9Pipeline;
  if (!audit || !pipeline?.portfolio || !pipeline?.evidenceBundle || !pipeline?.promotion || !pipeline?.safeExecution || !pipeline?.unsafeExecution) throw new TypeError('Checkpoint 9 report requires audit, portfolio, property, promotion, and execution evidence');
  return `# Nolane Agent Forensic Recovery Checkpoint 9 Verification Report

- Delivery commit: \`${gitHead}\`
- Checkpoint 8 baseline: \`${baselineCommit}\`
- Checkpoint status: **${checkpoint.verification.status}**
- Full Release Matrix: **${matrix.requiredPassed}/${matrix.requiredTotal} required gates ${matrix.status}**
- Matrix receipt: \`${matrix.receiptSha256}\`
- Master Ledger dispositions: ${audit.assertionVerified} verified, ${audit.assertionUnbound} unbound, ${audit.externalUnverified} external-unverified
- Mission portfolio: **${pipeline.portfolio.missions.length} missions**
- Mission portfolio receipt: \`${pipeline.portfolio.receiptSha256}\`
- Multi-file transfer receipt: \`${pipeline.portfolio.refactorTransfer?.receiptSha256 ?? 'missing'}\`
- SMT property receipt: \`${pipeline.portfolio.smtProperties?.receiptSha256 ?? 'missing'}\`
- Datalog property receipt: \`${pipeline.portfolio.datalogProperties?.receiptSha256 ?? 'missing'}\`
- Evidence bundle receipt: \`${pipeline.evidenceBundle.receiptSha256}\`
- Promotion v5 receipt: \`${pipeline.promotion.receiptSha256}\`
- Safe execution receipt: \`${pipeline.safeExecution.receiptSha256}\`
- Unsafe execution receipt: \`${pipeline.unsafeExecution.receiptSha256}\`
- NolaneNative unresolved truth records: ${checkpoint.truthLedger.unresolved}

## Non-claims

NolaneNative function-level parity remains unverified. General coding intelligence, small-model superintelligence, complete NolaneNative parity, comparative superiority, provider-real certification, external repository generalization, and Windows external certification remain unverified.
`;
}
