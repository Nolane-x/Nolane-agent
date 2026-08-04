# Forge Studio 1.0.0 verification contract

Date: 2026-07-29

The required release command is:

```bash
npm run release:matrix
```

The generated evidence is written to `release/matrix-1.0.0/` and is bound to the exact Git commit. Every gate records an independently hashed receipt.

## Required gates

1. Clean committed source tree.
2. Release identity and artifact version coherence.
3. Complete Forge Studio Node test suite.
4. Application syntax validation.
5. Authenticated loopback runtime smoke and unauthenticated rejection.
6. Deterministic evaluation suite.
7. VS Code TypeScript-source build and package validation.
8. Launcher, PTY, and credential Go module tests.
9. Python SDK tests.
10. ForgeOS full validation, smoke, adapter TCK, audit, certification, and mutation checks.
11. Item-level 790-feature audit.
12. Non-comparative self-benchmark and comparative-claim lock.
13. Release-scoped project manifest generation.
14. Windows x64 bootstrap and update-payload build.
15. Source and IDE archive packaging.
16. Fresh-source archive reconstruction including the complete ForgeOS vendor snapshot.
17. Archive path, CRC, required-content, byte-count, and SHA-256 verification.

The matrix runs all gates even after a failure and returns a failing exit status unless every required gate passes.

## Version-coherence rules

The following must all equal `config/release-identity.json`:

- Root package version.
- Runtime and launcher constants.
- VS Code package and VSIX manifest.
- TypeScript and Python SDK metadata.
- Project manifest and every manifest entry.
- Current README identity and current release-document links.
- Feature-audit product version.
- Source, Windows bootstrap, update payload, VSIX, checksum, integrity, and matrix artifact names.

## External evidence

Authenticode, Apple notarization, live-cloud isolation/conformance, external OIDC/SCIM interoperability, marketplace validation, and independent comparative benchmarking require separate real-world evidence.
