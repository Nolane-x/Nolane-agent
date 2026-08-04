# Forge Studio 3.2.0 — Verified Mission Runtime

## Release scope

This release promotes exactly 13 P0 requirements that were `partial` in 3.1.0: `29.3`, `29.8`, `29.13`, `29.14`, `29.16`, `34.9`, `34.11`, `34.12`, `34.13`, `34.14`, `40.4`, `40.12`, and `40.18`.

The implementation adds a bounded, lazy Verified Mission Runtime composed of:

- `VerifiedOutcomeLedger`: task, milestone, and mission criterion scores derived only from passing verification receipts; objective context usefulness; and cost bound to `decisionId`.
- `correctness-first-objective`: lexicographic correctness/regression/verification/resource ranking and explicit reward-hacking detection.
- `ToolEffectVerifier`: independent expected-versus-actual effect probes that identify false success and block commit.
- `ConfidenceCalibrationService`: separate calibration for requirement, retrieval, hypothesis, plan, execution, patch, and verification lanes.
- `DecisionStateMachine` and `SemanticProgressDetector`: verifier-bound state transitions and no-progress detection from criteria, tests, semantic effects, and information gain.
- `ResourceAttributionLedger`: trapezoidal `rssMbSeconds` attribution from resource through decision, task, milestone, and mission.
- `DiskBackedRawLog`: redacted, checksummed, cursor-based disk records while RAM snapshots retain summaries only.
- `ProcessLeakReaper`: registered process-tree cleanup with root identity checks, graceful termination, escalation, and fail-closed safety.
- Lazy integration through `DecisionPlane` and `MissionResourceFabric`; legacy fast paths do not instantiate the new runtime.

## Audit result

The 1,150-item audit for 3.2.0 reports:

- `verified_source_test`: 985
- `partial`: 102
- `external_gate`: 63
- `not_implemented`: 0

This does not mean all 1,150 requirements are fully production-certified. Every remaining partial and external-gated requirement is enumerated in `docs/REMAINING-GAPS-3.2.0.md`.

## Legacy external runtime optional-pack continuity

Forge Studio 3.2.0 does not republish the unchanged 67,431,284-byte NolaneNative Agent runtime archive. It preserves upstream commit `846b14ab01a84483d2c3dd429579173040474585`, archive SHA-256 `1ac5fcb20630d6556f6169cb836dda73298b2371f7c0a6ed23bcc5d6eaf41cd9`, and references the already certified optional artifact `ForgeStudio-LegacyExternalRuntime-2.16.0.zip`.

The release gate prefers direct archive verification when the certified pack is installed. Otherwise it accepts only the content-addressed carry-forward certificate that binds the prior successful matrix and unchanged integration hashes. The report records `archiveReadInCurrentRun: false`; core source, Windows, update, and VS Code artifacts do not contain `nolane_native-agent-main.zip` and do not invent a NolaneNative 3.2.0 pack.
