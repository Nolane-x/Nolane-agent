# Forge Studio 3.5.0 — Adaptive Learning & Trust Fabric

## Release scope

This release promotes exactly 11 requirements that were `partial` in 3.4.0: `38.2`, `38.6`, `38.7`, `38.10`, `38.12`, `38.13`, `38.14`, `38.18`, `47.6`, `47.10`, and `47.11`.

The implementation adds task-feature-conditioned routing, disjoint held-out evaluation, cohort canary rollback, verified strategy learning, delayed patch-survival evidence, domain/task/role trust isolation, state-capsule model switching, multi-turn tool trajectory calibration, structure-versus-surface task pairs, and oracle-separated teacher challenges.

## Audit result

The 1,150-item audit reports:

- `verified_source_test`: 1,028
- `partial`: 59
- `external_gate`: 63
- `not_implemented`: 0

This is not a claim that all requirements are complete. Every remaining partial and external-gated item is listed in `docs/REMAINING-GAPS-3.5.0.md`.

## Legacy external runtime optional-pack continuity

Forge Studio 3.5.0 preserves the already certified optional artifact `ForgeStudio-LegacyExternalRuntime-2.16.0.zip` through the existing content-addressed carry-forward policy. It does not invent or republish a NolaneNative 3.5.0 archive, and core artifacts do not bundle `nolane_native-agent-main.zip`.
