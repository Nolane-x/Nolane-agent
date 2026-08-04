export function createCheckpoint8DeliveryPlan() {
  const prefix = 'NolaneAgent-5.0.0-beta.6-forensic-recovery-checkpoint.8';
  return Object.freeze({
    prefix,
    baselineCommit: 'f5564c018ee9aabad313b298e2d2540fb1878316',
    planPath: 'docs/superpowers/plans/2026-08-02-forensic-recovery-checkpoint-8.md',
    outputSuffixes: Object.freeze([
      'source.zip', 'change-set.patch', 'change-set.zip', 'release-evidence.zip',
      'CHECKPOINT.md', 'CHECKPOINT.json', 'VERIFICATION-REPORT.md',
      'full-release-matrix.md', 'full-release-matrix.json',
      'assertion-evidence-baseline.json', 'master-ledger-assertion-audit.json',
      'mission-portfolio.json', 'ast-skill.json', 'ast-transfer.json',
      'smt-skill.json', 'smt-proof.json', 'datalog-skill.json', 'datalog-proof.json',
      'evidence-bundle.json', 'promotion.json', 'checkpoint-8-pipeline-evidence.json',
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
      'datasets/trajectories/checkpoint-8-v1/mission-portfolio.json',
      'models/checkpoint-8/ast-skill.json',
      'models/checkpoint-8/ast-transfer.json',
      'models/checkpoint-8/smt-skill.json',
      'models/checkpoint-8/smt-proof.json',
      'models/checkpoint-8/datalog-skill.json',
      'models/checkpoint-8/datalog-proof.json',
      'models/checkpoint-8/evidence-bundle.json',
      'models/checkpoint-8/promotion.json',
      'models/checkpoint-8/safe-execution.json',
      'models/checkpoint-8/unsafe-execution.json',
      'models/checkpoint-8/pipeline-evidence.json',
      'docs/superpowers/specs/2026-08-02-forensic-recovery-checkpoint-8-design.md',
      'docs/superpowers/plans/2026-08-02-forensic-recovery-checkpoint-8.md',
      'docs/checkpoints/NOLANE-FORENSIC-RECOVERY-CHECKPOINT-8.md',
      'docs/checkpoints/NOLANE-FORENSIC-RECOVERY-CHECKPOINT-8.json',
    ]),
  });
}

export function createCheckpoint8VerificationReport({ gitHead, baselineCommit, checkpoint, matrix }) {
  const audit = checkpoint?.masterLedgerAssertionAudit?.summary;
  const pipeline = checkpoint?.checkpoint8Pipeline;
  if (!audit || !pipeline?.portfolio || !pipeline?.evidenceBundle || !pipeline?.promotion || !pipeline?.safeExecution || !pipeline?.unsafeExecution) throw new TypeError('Checkpoint 8 report requires audit portfolio solver promotion and execution evidence');
  return `# Nolane Agent Forensic Recovery Checkpoint 8 Verification Report

- Delivery commit: \`${gitHead}\`
- Checkpoint 7 baseline: \`${baselineCommit}\`
- Checkpoint status: **${checkpoint.verification.status}**
- Full Release Matrix: **${matrix.requiredPassed}/${matrix.requiredTotal} required gates ${matrix.status}**
- Matrix receipt: \`${matrix.receiptSha256}\`
- Master Ledger dispositions: ${audit.assertionVerified} verified, ${audit.assertionUnbound} unbound, ${audit.externalUnverified} external-unverified
- Mission portfolio: **${pipeline.portfolio.missions.length} missions**
- Mission portfolio receipt: \`${pipeline.portfolio.receiptSha256}\`
- AST transfer receipt: \`${pipeline.portfolio.astTransfer?.receiptSha256 ?? 'not-provided-in-report-fixture'}\`
- SMT proof receipt: \`${pipeline.portfolio.smtProof?.receiptSha256 ?? 'not-provided-in-report-fixture'}\`
- Datalog proof receipt: \`${pipeline.portfolio.datalogProof?.receiptSha256 ?? 'not-provided-in-report-fixture'}\`
- Evidence bundle receipt: \`${pipeline.evidenceBundle.receiptSha256}\`
- Promotion v4 skills: **${pipeline.promotion.promotions.length}/3**
- Suite promotion receipt: \`${pipeline.promotion.receiptSha256}\`
- Safe execution receipt: \`${pipeline.safeExecution.receiptSha256}\`
- Unsafe execution receipt: \`${pipeline.unsafeExecution.receiptSha256}\`
- NolaneNative unresolved truth records: ${checkpoint.truthLedger.unresolved}

## Non-claims

NolaneNative function-level parity remains unverified. General coding intelligence, small-model superintelligence, complete NolaneNative parity, comparative superiority, provider-real certification, and Windows external certification remain unverified.
`;
}
