# Nolane Agent 5.0.0-alpha.5 — Release Notes

Alpha.5 extends the proof-driven local runtime without claiming a trained Nolane model or competitor parity.

## Verified additions

- `AstCodemodEngine`: token-aware JavaScript codemods that preserve strings and comments, reject unsafe shadowing, and validate delimiter balance.
- `FiniteDomainSmtAdapter`: bounded finite-domain constraint search with explicit proof receipts.
- `DatalogAdapter`: bounded fixpoint evaluation with safe variables and stratified negation.
- `ScientificBenchmarkHarness`: matched-budget, quantization, OOD and same-quality cost gates; every report remains `claimAllowed=false`.
- Lazy file-backed specialist artifacts with SHA-256 validation, pressure unload and a read-only mmap provider contract.
- Multi-agent policy distillation with disagreement evidence, held-out promotion and rollback.
- `AdaptationPolicyLearner` and latent-memory routing with verified outcomes, shadow/canary gates and negative-transfer rollback.
- `NolaneNativeCapabilityPack`: allowlisted web access, approval-gated computer use, worker/VM notebook isolation, durable cross-session memory, deterministic TUI, and credential-redacted media/audio providers.
- Authenticated production HTTP and Control Plane evidence for the new bounded operations.
- Active-brand and static UI quality audits with explicit external-certification limits.

## Acceptance ledger

The release targets 198 requirements: 192 with current source/test hashes and replay receipts, and 6 explicitly open external or retirement requirements.
