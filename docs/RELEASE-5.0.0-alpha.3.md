# Nolane Agent 5.0.0-alpha.3 — Verified Foundations Release

This release keeps the verified Nolane native runtime and adds proof-driven small-model foundations, NolaneNative production isolation, a complete Nolane acceptance ledger, and refreshed UI/research/audit specifications.

## Implemented in this release

- NolaneNative is a checksum-verified MIT reference artifact, disabled for execution by default; Nolane native remains the production runtime.
- Repository instructions and tool output pass through the content-ingress quarantine before provider messages.
- TrajectoryLab, VerifierMesh, SpecialistModelFabric, AdaptiveComputeGovernor and authenticated foundation HTTP routes are implemented and tested.
- The Control Plane reports foundation availability without claiming a trained Nolane model.
- The Nolane acceptance registry distinguishes verified source+test evidence from open work.
- Legacy 4.0 retention gates execute inside an isolated copy, never through source-mutating hardlinks.

## Non-claims

This alpha does not claim a trained proprietary foundation model, frontier-model parity, competitor superiority, independent Windows behavioral certification, or provider-real autonomous completion.

See `docs/LIMITATIONS-5.0.0-alpha.3.md`, `docs/VERIFICATION-REPORT-5.0.0-alpha.3.md`, and `docs/REMAINING-GAPS-5.0.0-alpha.3.md`.
