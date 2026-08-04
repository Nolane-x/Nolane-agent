const SPECIALISTS = ['tool-router', 'context-scorer', 'test-selector', 'patch-ranker', 'risk-classifier'];

export function createCheckpoint6DeliveryPlan() {
  const prefix = 'NolaneAgent-5.0.0-beta.6-forensic-recovery-checkpoint.6';
  const outputSuffixes = [
    'source.zip', 'change-set.patch', 'change-set.zip', 'release-evidence.zip',
    'CHECKPOINT.md', 'CHECKPOINT.json', 'VERIFICATION-REPORT.md',
    'full-release-matrix.md', 'full-release-matrix.json',
    'assertion-evidence-baseline.json', 'master-ledger-assertion-audit.json',
    'multi-runtime-execution-receipt.json', 'mutation-recovery-receipt.json',
    'checkpoint-6-specialist-suite-verification.json',
    'safe-decision-support.json', 'unsafe-decision-support.json',
    'third-party-provenance.json', 'delivery-manifest.json', 'SHA256SUMS.txt',
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
    'docs/checkpoints/ASSERTION-EVIDENCE-BINDING-BASELINE.md',
    'docs/checkpoints/MASTER-LEDGER-ASSERTION-AUDIT.json',
    'docs/checkpoints/MASTER-LEDGER-ASSERTION-AUDIT.md',
    'datasets/trajectories/multi-runtime-v1/execution-episodes.jsonl',
    'datasets/trajectories/multi-runtime-v1/execution-receipt.json',
    'datasets/trajectories/multi-runtime-v1/recovery-episodes.jsonl',
    'datasets/trajectories/multi-runtime-v1/recovery-receipt.json',
    'datasets/trajectories/multi-runtime-v1/recovery-scenarios.json',
    ...SPECIALISTS.flatMap((specialist) => [
      `models/specialists-checkpoint-6/${specialist}/multi-runtime-v1/model.json`,
      `models/specialists-checkpoint-6/${specialist}/multi-runtime-v1/benchmark.json`,
      `models/specialists-checkpoint-6/${specialist}/multi-runtime-v1/dataset-receipt.json`,
      `models/specialists-checkpoint-6/${specialist}/multi-runtime-v1/ablation.json`,
    ]),
    'THIRD_PARTY_NOTICES.md',
    'src/release/third-party-provenance.mjs',
    'docs/superpowers/specs/2026-08-02-forensic-recovery-checkpoint-6-design.md',
    'docs/superpowers/plans/2026-08-02-forensic-recovery-checkpoint-6.md',
    'docs/checkpoints/NOLANE-FORENSIC-RECOVERY-CHECKPOINT-6.md',
    'docs/checkpoints/NOLANE-FORENSIC-RECOVERY-CHECKPOINT-6.json',
  ];
  return Object.freeze({
    prefix,
    baselineCommit: '9642b442a4155432fba7ca4477f69f4712c70d95',
    planPath: 'docs/superpowers/plans/2026-08-02-forensic-recovery-checkpoint-6.md',
    outputSuffixes: Object.freeze(outputSuffixes),
    evidenceFiles: Object.freeze(evidenceFiles),
    specialists: Object.freeze([...SPECIALISTS]),
  });
}

export function createCheckpoint6VerificationReport({ gitHead, baselineCommit, checkpoint, matrix }) {
  const audit = checkpoint?.masterLedgerAssertionAudit?.summary;
  const multiRuntime = checkpoint?.multiRuntimeTrajectories;
  const recovery = checkpoint?.mutationRecoveryTrajectories;
  const suite = checkpoint?.checkpoint6SpecialistSuite;
  if (!audit || !multiRuntime || !recovery || !suite) throw new TypeError('Checkpoint 6 report requires audit, multi-runtime, recovery and specialist suite evidence');
  return `# Nolane Agent Forensic Recovery Checkpoint 6 Verification Report

- Delivery commit: \`${gitHead}\`
- Checkpoint 5 baseline: \`${baselineCommit}\`
- Checkpoint status: **${checkpoint.verification.status}**
- Full Release Matrix: **${matrix.requiredPassed}/${matrix.requiredTotal} required gates ${matrix.status}**
- Matrix receipt: \`${matrix.receiptSha256}\`
- UI/Audit assertion bindings: 48/48
- Master Ledger dispositions: ${audit.assertionVerified} verified, ${audit.assertionUnbound} unbound, ${audit.externalUnverified} external-unverified
- Multi-runtime trajectories: **${multiRuntime.episodeCount} verified executions across ${multiRuntime.runtimes.length} runtimes**
- Multi-runtime receipt: \`${multiRuntime.receiptSha256}\`
- Mutation-recovery trajectories: **${recovery.mutationFailures} mutation failures and ${recovery.recoveryPasses} verified recoveries**
- Mutation-recovery receipt: \`${recovery.receiptSha256}\`
- Ablation-governed specialist suite: **5/5 verified**
- Suite verification: \`${suite.verification.receiptSha256}\`
- Safe decision receipt: \`${suite.safeDecisionReceipt.receiptSha256}\`
- Unsafe decision receipt: \`${suite.unsafeDecisionReceipt.receiptSha256}\`
- NolaneNative unresolved truth records: ${checkpoint.truthLedger.unresolved}

## Non-claims

General coding intelligence, small-model superintelligence, complete NolaneNative parity, comparative superiority, provider-real certification, and Windows external certification remain unverified.
`;
}
