# Forge Studio 1.2.0 release notes

Date: 2026-07-29

## Workspace Trust & Governance Center

Forge Studio 1.2.0 adds an identity-bound workspace trust boundary. A repository is untrusted by default and remains limited to safe inspection until an authenticated principal explicitly records a reasoned trust decision. Replacing the workspace directory or its Git identity invalidates the decision automatically.

The professional Workspace Trust Center displays the canonical path, filesystem identity fingerprint, feature-by-feature policy state, latest decision receipt, and immutable audit history. Trust and revoke actions are performed through authenticated APIs; client-side UI state never grants authority.

## Security and provenance

- The original legacy upstream MIT license and Nous Research attribution are preserved.
- The source archive, byte count, SHA-256 digest, required upstream files, and commit identity are fail-closed release inputs.
- ZIP extraction rejects path traversal, absolute paths, duplicate entries, symlinks, encryption, unsupported compression, decompression size mismatches, and bounded-size violations.
- Instructions, hooks, skill profiles, MCP tools, plugin context, environment bootstrap, scheduled goals, automations, and background agent runs fail closed until the workspace is trusted.
- Stop and revoke operations remain available so users can always return the system to a safe state.
- Secrets and environment values are not returned through the Runtime Control Center or operation receipts.
- Fresh-source reconstruction verifies both ForgeOS and NolaneNative vendor snapshots.

## Release matrix

The mandatory full release matrix includes both `nolane_native-vendor-integrity` and `workspace-trust-governance` gates in addition to version coherence, complete runtime tests, ForgeOS validation, SDK and IDE builds, benchmark claim lock, fresh-source reconstruction, packaging, and archive verification.

## Release boundary

This release does not claim that NolaneNative cloud services, third-party account integrations, external messaging gateways, or hosted infrastructure are operational. Only the local source snapshot, governed ACP sidecar contract, API, UI, tests, and release evidence are included.
