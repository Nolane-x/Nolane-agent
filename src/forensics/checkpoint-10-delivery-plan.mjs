export function createCheckpoint10DeliveryPlan() {
  const prefix = 'NolaneAgent-5.0.0-beta.6-forensic-recovery-checkpoint.10';
  return Object.freeze({
    prefix,
    baselineCommit: '63b69383df55464226b75556bc82d48a35f0a84a',
    planPath: 'docs/superpowers/plans/2026-08-02-forensic-recovery-checkpoint-10.md',
    outputSuffixes: Object.freeze([
      'source.zip', 'change-set.patch', 'change-set.zip', 'release-evidence.zip',
      'CHECKPOINT.md', 'CHECKPOINT.json', 'VERIFICATION-REPORT.md',
      'full-release-matrix.md', 'full-release-matrix.json',
      'assertion-evidence-baseline.json', 'master-ledger-assertion-audit.json',
      'mission-portfolio.json', 'typescript-skill.json', 'typescript-transfer.json',
      'typescript-properties.json', 'cross-language-migration.json', 'evidence-bundle.json',
      'promotion.json', 'checkpoint-10-pipeline-evidence.json',
      'safe-typescript-execution.json', 'safe-contract-migration.json', 'unsafe-execution.json',
      'delivery-manifest.json', 'SHA256SUMS.txt',
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
      'datasets/trajectories/checkpoint-10-v1/mission-portfolio.json',
      'models/checkpoint-10/typescript-skill.json',
      'models/checkpoint-10/typescript-transfer.json',
      'models/checkpoint-10/typescript-properties.json',
      'models/checkpoint-10/cross-language-migration.json',
      'models/checkpoint-10/evidence-bundle.json',
      'models/checkpoint-10/promotion.json',
      'models/checkpoint-10/safe-typescript-execution.json',
      'models/checkpoint-10/safe-contract-migration.json',
      'models/checkpoint-10/unsafe-execution.json',
      'models/checkpoint-10/pipeline-evidence.json',
      'docs/superpowers/specs/2026-08-02-forensic-recovery-checkpoint-10-design.md',
      'docs/superpowers/plans/2026-08-02-forensic-recovery-checkpoint-10.md',
      'docs/checkpoints/NOLANE-FORENSIC-RECOVERY-CHECKPOINT-10.md',
      'docs/checkpoints/NOLANE-FORENSIC-RECOVERY-CHECKPOINT-10.json',
    ]),
  });
}

export function createCheckpoint10VerificationReport({ gitHead, baselineCommit, checkpoint, matrix }) {
  const audit = checkpoint?.masterLedgerAssertionAudit?.summary;
  const pipeline = checkpoint?.checkpoint10Pipeline;
  if (!audit || !pipeline?.portfolio || !pipeline?.evidenceBundle || !pipeline?.promotion || !pipeline?.safeTypeScriptExecution || !pipeline?.safeContractMigration || !pipeline?.unsafeExecution) throw new TypeError('Checkpoint 10 report requires audit, semantic transfer, property, migration, promotion, and execution evidence');
  return `# Nolane Agent Forensic Recovery Checkpoint 10 Verification Report

- Delivery commit: \`${gitHead}\`
- Checkpoint 9 baseline: \`${baselineCommit}\`
- Checkpoint status: **${checkpoint.verification.status}**
- Full Release Matrix: **${matrix.requiredPassed}/${matrix.requiredTotal} required gates ${matrix.status}**
- Matrix receipt: \`${matrix.receiptSha256}\`
- Master Ledger dispositions: ${audit.assertionVerified} verified, ${audit.assertionUnbound} unbound, ${audit.externalUnverified} external-unverified
- Mission portfolio: **${pipeline.portfolio.missions.length} missions**
- Mission portfolio receipt: \`${pipeline.portfolio.receiptSha256}\`
- TypeScript semantic transfer receipt: \`${pipeline.portfolio.typescriptTransfer?.receiptSha256 ?? 'missing'}\`
- TypeScript property receipt: \`${pipeline.portfolio.typescriptProperties?.receiptSha256 ?? 'missing'}\`
- Cross-language migration receipt: \`${pipeline.portfolio.contractMigration?.receiptSha256 ?? 'missing'}\`
- Evidence bundle receipt: \`${pipeline.evidenceBundle.receiptSha256}\`
- Promotion v6 receipt: \`${pipeline.promotion.receiptSha256}\`
- Safe TypeScript execution receipt: \`${pipeline.safeTypeScriptExecution.receiptSha256}\`
- Safe contract migration receipt: \`${pipeline.safeContractMigration.receiptSha256}\`
- Unsafe execution receipt: \`${pipeline.unsafeExecution.receiptSha256}\`
- NolaneNative unresolved truth records: ${checkpoint.truthLedger.unresolved}

## Non-claims

NolaneNative function-level parity remains unverified. General coding intelligence, small-model superintelligence, complete NolaneNative parity, comparative superiority, provider-real certification, external repository generalization, and Windows external certification remain unverified.
`;
}
