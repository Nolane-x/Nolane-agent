# NolaneNative Sidecar & Runtime Control Center Design

## Goal

Reuse the uploaded MIT-licensed NolaneNative Agent snapshot as an immutable sidecar runtime while Forge Studio remains the policy, audit, orchestration, and user-experience control plane.

## Decision

Forge Studio will not merge NolaneNative Python internals directly into the Node agent loop. It will vendor the exact upstream snapshot as a content-addressed archive, preserve the MIT license and commit provenance, extract it safely into the local data directory, inspect ACP readiness, and supervise the sidecar as a separate process. Later releases may delegate sessions over ACP without changing this trust boundary.

## Components

1. `NolaneNativeVendorService` verifies archive SHA-256, file paths, license, provenance, and capability inventory.
2. `NolaneNativeRuntimeService` safely prepares, checks, starts, stops, and reports the local ACP sidecar. State-changing operations require `shell.run` and `mcp.use` capability decisions.
3. Authenticated HTTP routes expose bounded public status, capabilities, preparation, readiness, start, and stop operations.
4. Runtime Control Center UI exposes Forge native runtime, NolaneNative sidecar, capability categories, readiness diagnostics, provenance, and governed controls in a professional dashboard.
5. Full release matrix gains a NolaneNative vendor-integrity gate. Source reconstruction must include the exact archive, license, provenance, and manifest.

## Security

- The uploaded snapshot is treated as untrusted third-party source until its content hash and safe ZIP entry set pass verification.
- Extraction rejects traversal, absolute paths, encrypted files, symlinks, duplicate paths, unsupported compression, excess entries, excess bytes, and decompression-size mismatch.
- NolaneNative is never given Forge secrets implicitly. Environment allowlisting is explicit.
- Start/stop cannot bypass Forge capability policy.
- UI and API never return environment values, access tokens, or raw process output beyond bounded redacted diagnostics.

## Testing

Tests cover vendor tampering, safe extraction, capability inventory, readiness classification, lifecycle controls, capability denial, HTTP authentication, UI accessibility, application composition, source reconstruction, and release-matrix gate presence.
