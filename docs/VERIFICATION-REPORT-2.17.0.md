# Forge Studio 2.17.0 verification report

## Contract

Release acceptance requires a clean committed source tree and a passing Full Release Matrix. The `adaptive-work-fabric` gate verifies runtime leases, provider/browser integration, shared repository scheduling, adaptive swarm reconciliation, raw measurement, unchanged item-level audit counts and explicit non-claims.

## Direct focused evidence

- Runtime lease tests cover global/per-key limits, attribution, abort cleanup, emergency admission, idle eviction and bounded receipts.
- Provider and browser tests prove real call paths pass through their pools.
- Repository scheduler tests cover priority, coalescing, stale cancellation, semantic pressure policy, abort and lifecycle wiring.
- Adaptive graph tests cover add/revise/revoke, cycles, ownership serialization, uncertainty stops, retry exhaustion and explicit operating-plane authorization.

## Release result

The final gate count, commit and artifact receipts are written by `release/matrix/full-release-matrix.json` and `release/matrix/full-release-matrix.md`. This document is not independent certification of external providers, Windows/macOS kernels, cloud sandboxes, hosted PR/CI or benchmark superiority.
