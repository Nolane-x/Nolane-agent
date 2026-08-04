# Nolane Agent 5.0.0-alpha.4 — Verified Adaptive Foundations Release

This release extends the alpha.3 proof-driven runtime with larger local-verifiable foundations for distillation, recursive compute, symbolic compilation, bounded plasticity, reproducible curricula, specialist trust, compute calibration and Nolane-native operational boundaries.

## Implemented in this release

- `DistillationOrchestrator` verifies every public state/action/effect step with an independent read-only oracle, rejects hallucination, loops, effectless actions, unsafe/reward-hacking terminal passes, separates offline/on-policy lanes, measures divergence, supports domain-trusted teachers, held-out promotion and policy rollback.
- Hidden compositional verification and verifier red-team receipts prevent self-reported passes, hidden-data access, write attempts, malformed verdicts and evidence-free acceptance.
- `RecursivePolicySidecar` provides fixed-memory recurrent state, adaptive depth, convergence/collapse detection, non-loop fallback and latent-state hashes without storing hidden chain-of-thought.
- `SymbolicSolverCompiler` induces typed declarative solvers from verified episodes, records soundness/incompleteness, gates transfer and composition, sandboxes execution, versions/rolls back solvers and measures amortized value.
- `PlasticityPlane` reinforces non-parametric memory, bounds adapter candidates by norm/KL/regression budgets, keeps learning in shadow, consolidates verified experience and rolls back negative transfer.
- `CurriculumFactory` builds Git-optional repository environments, verifies mutations with independent receipts, separates bug-maker/solver/adversary roles, controls contamination, preserves licenses and creates byte-reproducible dataset snapshots.
- Specialist trust is domain-conditioned; state/embedding schemas are typed; every active specialist requires an independent held-out benchmark receipt.
- Compute escalation thresholds are calibrated from held-out labels, versioned and rollback-capable.
- Nolane-native operational APIs expose credential references, path/irreversible-action boundaries and self-diagnosing dependency preflight without importing or executing NolaneNative runtime code.
- Control Plane Labs exposes subsystem counts and explicit non-claims.

## Acceptance state

The Nolane acceptance ledger contains **198 requirements: 175 verified and 23 open**. Verification requires a production entrypoint, exact automated test, fresh source/test SHA-256 values and a replay receipt.

## Non-claims

This release does not claim a trained Nolane foundation model, frontier parity, competitor superiority, provider-real autonomous completion, Windows 8 GB performance certification, same-FLOP/quantization/OOD gains, AST/SMT support, learned adaptation policies or autonomous self-improvement.

See `docs/LIMITATIONS-5.0.0-alpha.4.md`, `docs/VERIFICATION-REPORT-5.0.0-alpha.4.md`, and `docs/REMAINING-GAPS-5.0.0-alpha.4.md`.
