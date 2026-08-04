# Forge Studio 0.9.0 verification contract

Date: 2026-07-28

This tracked document defines the required verification surface for 0.9.0. The fresh machine-generated result is written by `npm run release:matrix` to:

- `release/matrix-0.9.0/full-release-matrix.json`
- `release/matrix-0.9.0/full-release-matrix.md`
- `release/matrix-0.9.0/logs/*.log`

The generated report is bound to the exact Git commit and includes a SHA-256 receipt for every gate.

## Required gates

1. Clean committed source tree.
2. Complete Forge Studio Node test suite.
3. Application syntax validation.
4. Authenticated loopback runtime smoke and unauthenticated rejection.
5. Deterministic evaluation suite.
6. VS Code TypeScript-source build and package validation.
7. Launcher, PTY, and credential Go module tests.
8. Python SDK unit tests.
9. ForgeOS full validation.
10. ForgeOS smoke, adapter TCK, 0.6 audit, skill certification, and critical mutation checks.
11. Item-level 790-feature audit.
12. Non-comparative self-benchmark.
13. Benchmark claim lock requiring `independent: false` and `claimAllowed: false` for self-smoke evidence.
14. Release-scoped project manifest generation.
15. Windows x64 bootstrap and update-payload build.
16. Source and VS Code archive packaging.
17. Archive path, required-content, byte-count, and SHA-256 verification.

The runner deliberately executes later gates after an earlier gate fails. The release succeeds only when every required gate passes.

## Evidence rules

- Logs are scanned and redacted before persistence.
- Commands are argv arrays and are never composed through a shell by the matrix runner.
- Each gate records command, arguments, working directory, exit code, duration, stdout/stderr hashes, log path, and receipt hash.
- Release packaging uses `release/project-manifest-0.9.0.json`; it does not mutate the tracked source manifest.
- Source and VSIX archives are created deterministically and reject traversal, duplicate entries, symlinks, CRC errors, required-file omissions, and forbidden paths.
- The self-benchmark cannot authorize a comparative claim.

## External evidence not produced by the local matrix

Authenticode, Apple notarization, live-cloud conformance, enterprise interoperability, marketplace acceptance, and independent comparative benchmarking require separate signed evidence. Their absence must remain visible in release metadata.
