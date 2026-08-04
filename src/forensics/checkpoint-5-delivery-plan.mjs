const SPECIALISTS = ['tool-router', 'context-scorer', 'test-selector', 'patch-ranker', 'risk-classifier'];

export function createCheckpoint5DeliveryPlan() {
  const prefix = 'NolaneAgent-5.0.0-beta.6-forensic-recovery-checkpoint.5';
  const outputSuffixes = [
    'source.zip', 'change-set.patch', 'change-set.zip', 'release-evidence.zip',
    'CHECKPOINT.md', 'CHECKPOINT.json', 'VERIFICATION-REPORT.md',
    'full-release-matrix.md', 'full-release-matrix.json',
    'assertion-evidence-baseline.json', 'master-ledger-assertion-audit.json',
    'repository-trajectory-receipt.json', 'repository-specialist-suite-verification.json',
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
    'docs/checkpoints/ASSERTION-EVIDENCE-BINDING-BASELINE.md',
    'docs/checkpoints/MASTER-LEDGER-ASSERTION-AUDIT.json',
    'docs/checkpoints/MASTER-LEDGER-ASSERTION-AUDIT.md',
    'datasets/trajectories/repository-v1/episodes.jsonl',
    'datasets/trajectories/repository-v1/receipt.json',
    ...SPECIALISTS.flatMap((specialist) => [
      `models/specialists-repository/${specialist}/repository-v1/model.json`,
      `models/specialists-repository/${specialist}/repository-v1/benchmark.json`,
      `models/specialists-repository/${specialist}/repository-v1/dataset-receipt.json`,
    ]),
    'docs/checkpoints/NOLANE-FORENSIC-RECOVERY-CHECKPOINT-5.md',
    'docs/checkpoints/NOLANE-FORENSIC-RECOVERY-CHECKPOINT-5.json',
  ];
  return Object.freeze({
    prefix,
    baselineCommit: 'a435c7fa9d75b53fe526f5abb9f41ab71873f976',
    planPath: 'docs/superpowers/plans/2026-08-02-forensic-recovery-checkpoint-5.md',
    outputSuffixes: Object.freeze(outputSuffixes),
    evidenceFiles: Object.freeze(evidenceFiles),
    specialists: Object.freeze([...SPECIALISTS]),
  });
}
