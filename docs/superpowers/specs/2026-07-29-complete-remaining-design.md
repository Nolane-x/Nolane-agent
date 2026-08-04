# Forge Studio 2.8.0 Complete Remaining Design

## Scope
Close every remaining `not_implemented` surface with real source and direct tests. Browser, secrets, and Tree-sitter must be locally runnable. Podman, Windows Job Objects, and macOS sandbox receive concrete platform drivers with capability detection and fail-closed behavior; audit status remains external-gated where this Linux release runner cannot prove native enforcement.

## Architecture
- `IntegratedBrowserCenter` projects existing governed browser sessions into an authenticated UI with navigation, snapshots, tabs, screenshots, and close controls. No arbitrary local file URLs or credential injection.
- `SecretsManagerService` wraps `CredentialVault`, records metadata-only receipts, scopes aliases, and never returns plaintext through list APIs or UI.
- `TreeSitterRuntimeService` loads a vendored WebAssembly runtime and pinned JavaScript grammar, exposes bounded parse/query results, incremental edit support, and source-addressed receipts.
- `PodmanSandboxDriver`, `WindowsJobObjectDriver`, and `MacOSSandboxDriver` expose the same capability/create/attach/terminate contract. Missing binaries or wrong platforms fail closed and return explicit external-gate evidence.

## Security boundaries
No UI or HTTP response exposes secret values. Browser navigation is HTTP(S)/about:blank only. Tree-sitter grammars are vendored and checksum-pinned. Sandbox drivers never silently fall back to an unisolated process while claiming native isolation.

## Verification
TDD unit tests, HTTP/UI integration tests, verifier gate, feature audit, version coherence, full Node suite, build/package/source reconstruction, and archive integrity.
