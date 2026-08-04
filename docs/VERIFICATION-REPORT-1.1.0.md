# Forge Studio 1.1.0 verification contract

Date: 2026-07-29

The required release command is:

```bash
npm run release:matrix
```

Evidence is written to `release/matrix-1.1.0/` and bound to the exact Git commit. Every gate records an independently hashed receipt.

## Required gates

1. Clean committed source tree.
2. Release identity and artifact version coherence.
3. NolaneNative Agent MIT snapshot provenance, checksum, required-entry, and capability-evidence verification.
4. Complete Forge Studio Node test suite.
5. Application syntax validation.
6. Authenticated loopback runtime smoke and unauthenticated rejection.
7. Deterministic evaluation suite.
8. VS Code TypeScript-source build and package validation.
9. Launcher, PTY, and credential Go module tests.
10. Python SDK tests.
11. ForgeOS validation, smoke, adapter TCK, audit, certification, and mutation checks.
12. Item-level 790-feature audit.
13. Non-comparative benchmark smoke and comparative-claim lock.
14. Release-scoped project manifest generation.
15. Windows x64 bootstrap and update-payload build.
16. Source and IDE archive packaging.
17. Fresh-source reconstruction including complete ForgeOS and NolaneNative snapshots.
18. Archive path, CRC, required-content, byte-count, and SHA-256 verification.

The matrix runs every gate even after a failure and returns failure unless every required gate passes.

## NolaneNative-specific evidence

- Upstream commit and repository identity.
- Original MIT license and attribution.
- Archive byte count and SHA-256.
- Safe extraction constraints.
- Governed lifecycle API and authenticated UI access.
- Deny-first capability decisions for sidecar execution.
- Source-archive reconstruction and release-archive presence.
