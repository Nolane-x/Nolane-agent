# Forge Studio 3.4.0 — Construction Safety Completion

## Release scope

This release promotes exactly 21 requirements that were `partial` in 3.3.0: `34.16`; `35.6`, `35.7`, `35.11`, `35.12`, `35.13`, `35.15`; `36.4`, `36.5`, `36.6`, `36.11`, `36.14`, `36.16`; `37.4`, `37.5`, `37.11`, `37.15`; and `46.9`, `46.11`, `46.13`, `46.16`.

The implementation adds contract-first construction, bounded ownership, real candidate worktrees, exact state restoration, semantic change safety, independent verification, encrypted hidden regressions, causal intervention, and strict counterfactual verification before execution.

## Audit result

The 1,150-item audit reports:

- `verified_source_test`: 1,017
- `partial`: 70
- `external_gate`: 63
- `not_implemented`: 0

This is not a claim that all requirements are complete. Every remaining partial and external-gated item is listed in `docs/REMAINING-GAPS-3.4.0.md`.

## Legacy external runtime optional-pack continuity

Forge Studio 3.4.0 preserves the already certified optional artifact `ForgeStudio-LegacyExternalRuntime-2.16.0.zip` through the existing content-addressed carry-forward policy. It does not invent or republish a NolaneNative 3.4.0 archive, and core artifacts do not bundle `nolane_native-agent-main.zip`.
