# NolaneNative Certified Carry-Forward Design

## Goal

Allow Forge Studio 3.1.0 to certify and reference the unchanged NolaneNative Agent optional pack that was directly verified by the Forge Studio 3.0.0 release matrix, without weakening the content-addressed archive contract or pretending the 67,431,284-byte archive is locally present.

## Decision

Use a fail-closed carry-forward certificate only when the current release cannot locate the optional archive. Direct archive verification remains preferred whenever the pack is installed.

The certificate binds:

- the prior Forge Studio release identity, source archive SHA-256, evidence archive SHA-256, full matrix receipt, NolaneNative gate receipt, and NolaneNative service receipt;
- the legacy upstream commit, archive byte count, archive SHA-256, license SHA-256, and required ZIP entries;
- the exact SHA-256 of every runtime and integration file whose unchanged state makes the prior verification applicable;
- the existing optional-pack artifact name `ForgeStudio-LegacyExternalRuntime-2.16.0.zip`.

The verifier recomputes all current hashes and fails if any protected file, manifest field, receipt, or non-claim changes. The certificate never claims the archive was read in the current run. Its report mode is `certified-carry-forward`, while a locally installed archive reports `direct-archive`.

## Release behavior

Core source, Windows, update, and VS Code artifacts continue to exclude the large NolaneNative archive. When direct archive bytes are absent but the certificate passes, the 3.1.0 release manifest references the previously certified optional pack and marks it `reuse-certified`; it does not create or checksum a fake 3.1.0 NolaneNative pack.

Archive verification checks only artifacts actually published by the current release and separately verifies the carry-forward certificate. Source reconstruction must continue to start without the optional pack.

## Safety boundaries

- No manifest SHA, archive size, upstream commit, or required entry may change through carry-forward.
- No current run may report that the NolaneNative archive was opened or decompressed unless direct verification occurred.
- Any protected-file drift forces direct archive verification or a new certification.
- A failed or missing prior matrix/gate receipt is fatal.
- This mechanism applies only to unchanged, optional, content-addressed components; it is not a general bypass for required build inputs.

## Tests

Tests cover valid carry-forward, protected-file tampering, manifest drift, invalid prior receipts, direct-verification preference, packaging reuse, archive-integrity behavior, and release-matrix integration.
