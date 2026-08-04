# Forge Studio 1.1.0 release notes

Date: 2026-07-29

## NolaneNative sidecar and Runtime Control Center

Forge Studio 1.1.0 adds a content-addressed snapshot of the MIT-licensed NolaneNative Agent at upstream commit `846b14ab01a84483d2c3dd429579173040474585`. NolaneNative remains an isolated Python ACP sidecar; Forge Studio continues to own authorization, lifecycle, audit, receipts, release verification, and all user-facing controls.

The Runtime Control Center adds a professional operational surface for Forge Runtime and NolaneNative Agent. It displays real readiness, PID, source commit, archive digest, imported capability evidence, and governed prepare/check/start/stop actions.

## Security and provenance

- The original legacy upstream MIT license and Nous Research attribution are preserved.
- The source archive, byte count, SHA-256 digest, required upstream files, and commit identity are fail-closed release inputs.
- ZIP extraction rejects path traversal, absolute paths, duplicate entries, symlinks, encryption, unsupported compression, decompression size mismatches, and bounded-size violations.
- NolaneNative execution uses argv-only process spawning and cannot start without Forge capability grants for `shell.run` and `mcp.use`.
- Secrets and environment values are not returned through the Runtime Control Center or operation receipts.
- Fresh-source reconstruction verifies both ForgeOS and NolaneNative vendor snapshots.

## Release matrix

The mandatory full release matrix now includes the `nolane_native-vendor-integrity` gate in addition to version coherence, complete runtime tests, ForgeOS validation, SDK and IDE builds, benchmark claim lock, fresh-source reconstruction, packaging, and archive verification.

## Release boundary

This release does not claim that NolaneNative cloud services, third-party account integrations, external messaging gateways, or hosted infrastructure are operational. Only the local source snapshot, governed ACP sidecar contract, API, UI, tests, and release evidence are included.
