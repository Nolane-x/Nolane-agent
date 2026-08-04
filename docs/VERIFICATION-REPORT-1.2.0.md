# Forge Studio 1.2.0 verification contract

Date: 2026-07-29

The required release command is:

```bash
npm run release:matrix
```

Evidence is written to `release/matrix-1.2.0/` and bound to the exact Git commit. Every gate records an independently hashed receipt.

## Required gates

1. Clean committed source tree.
2. Release identity and artifact version coherence.
3. NolaneNative Agent MIT snapshot provenance, checksum, required-entry, and capability-evidence verification.
4. Workspace trust identity, persistence, gates, authenticated API, and Control Center verification.
5. Complete Forge Studio Node test suite.
6. Application syntax validation.
7. Authenticated loopback runtime smoke and unauthenticated rejection.
8. Deterministic evaluation suite.
9. VS Code TypeScript-source build and package validation.
10. Launcher, PTY, and credential Go module tests.
11. Python SDK tests.
12. ForgeOS validation, smoke, adapter TCK, audit, certification, and mutation checks.
13. Item-level 790-feature audit.
14. Non-comparative benchmark smoke and comparative-claim lock.
15. Release-scoped project manifest generation.
16. Windows x64 bootstrap and update-payload build.
17. Source and IDE archive packaging.
18. Fresh-source reconstruction including complete ForgeOS and NolaneNative snapshots.
19. Archive path, CRC, required-content, byte-count, and SHA-256 verification.

The matrix runs every gate even after a failure and returns failure unless every required gate passes.

## NolaneNative-specific evidence

- Upstream commit and repository identity.
- Original MIT license and attribution.
- Archive byte count and SHA-256.
- Safe extraction constraints.
- Governed lifecycle API and authenticated UI access.
- Deny-first capability decisions for sidecar execution.
- Source-archive reconstruction and release-archive presence.

## Workspace-trust evidence

- Default-deny state and authenticated trust/revoke decisions.
- Canonical workspace and Git identity fingerprint binding.
- Persistent SQLite decision and audit history across restart.
- Automatic invalidation when the workspace identity is replaced.
- Fail-closed gates for instructions, hooks, profiles/skills, MCP, plugins, bootstrap, goals, automations, and background runs.
- Professional UI status and controls backed by authenticated server decisions.
