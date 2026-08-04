# Forge Studio 0.3.0 release notes

## Native Workroom

- Real Windows ConPTY terminal host with WebSocket streaming, resize, snapshot, reconnect, ownership, and resource limits.
- Monaco editor models, tabs, save conflict detection, and diff surface.
- Verified local xterm/Monaco asset pipeline with lazy loading and fallback editor.
- Lazy file tree with binary, secret, traversal, symlink, size, and path-policy enforcement.

## Security and operations

- Windows Credential Manager helper and server-side secret references.
- Ed25519 signed update manifests, HTTPS-only package fetch, SHA-256, safe ZIP inspection, versioned extraction, health check, rollback, and incomplete-update recovery.
- Windows metadata replacement through `MoveFileExW` with replace-existing/write-through.
- Project instruction discovery with provenance and path scope.
- Resource governor for memory, event-loop, output, queue, terminal, and optional-feature admission.

## Packaging

- Windows release includes `ForgeStudio.exe`, `ForgePty.exe`, and `ForgeCredential.exe`.
- Build emits both a full portable ZIP and a user-data-free update payload ZIP.
- Release tools generate Ed25519 keys and signed manifests without placing private keys in the product.

## Compatibility

- Node.js 22.12+ source runtime.
- Windows 10 1809+ is required for ConPTY; Windows 11 is the primary target.
- Existing Forge Studio 0.2 project/task data remains in the same local data directory.
