# Nolane Agent 5.0.0-beta.1 — Limitations

No Nolane foundation model has been trained. The small-model modules are deterministic harnesses, policies, routers, verifiers and bounded adapters; they are not evidence of frontier-model parity or AGI.

There are 5 open requirements:

1. Windows 8 GB performance baseline measured on reference hardware.
2. Full runtime/manual WCAG certification.
3. Runtime responsive visual certification across required breakpoints.
4. Runtime DOM, CPU, memory, latency and visual-regression budgets.
5. Provider-real Windows dogfood and independent attestation.

The source-level UI audit records `runtimeCertification=false`; it does not substitute for keyboard, screen-reader or visual execution. Provider-real Windows dogfood remains pending. Benchmark receipts use `claimAllowed=false`. NolaneNative executable and packaged surfaces are retired; only immutable historical attribution and transformation evidence remain.

Canonical evidence files are `docs/feature-audit-5.0.0-beta.1.json` and `docs/REMAINING-GAPS-5.0.0-beta.1.md`.

## Beta.1 external release gates

- The repository contains the deterministic NSIS and GitHub Actions pipeline, but this Linux clean-room run cannot itself produce or attest the final Windows `.exe`.
- Authenticode signing remains external until `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` are configured in GitHub Secrets.
- A published GitHub Release and update-feed replay on a real Windows machine remain required before stable release.
- NolaneNative is retired from executable and packaged surfaces. Historical attribution and transformation evidence remain documentation only.
