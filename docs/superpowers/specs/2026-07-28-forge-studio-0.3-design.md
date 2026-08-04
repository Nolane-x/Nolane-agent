# Forge Studio 0.3 Design — Native Workroom, Secure Credentials, and Signed Updates

## Status

Approved by the product owner through the explicit request to complete the missing embedded PTY, Monaco editor, OS keychain, and auto-update capabilities, while preserving ForgeOS governance and minimizing runtime cost.

## Goal

Turn Forge Studio 0.2 into a complete local coding-agent workroom with an embedded terminal, a conflict-safe Monaco editor, OS-backed secret storage, and a cryptographically verified update pipeline without replacing the proven ForgeOS control plane or expanding the default runtime into a heavyweight IDE.

## Architecture decision

Forge Studio 0.3 keeps the existing three-process shape:

1. `ForgeStudio.exe` — native launcher and lifecycle owner.
2. Node.js control plane — agent runtime, ForgeOS integration, HTTP/SSE/WebSocket services.
3. Browser app-mode WebView — local UI.

It adds two small native helpers:

- `ForgePty.exe`: a JSONL-RPC pseudoterminal host. Windows uses ConPTY; Unix development builds use a POSIX PTY. The helper owns process groups, resize, bounded output, and termination.
- `ForgeCredential.exe`: an OS credential helper. Windows uses Credential Manager. The Node control plane can set, resolve, list metadata, and delete secrets without returning plaintext to the browser.

This hybrid design is selected over a full Tauri migration because it preserves the tested Node/ForgeOS runtime, avoids introducing a second application framework, and isolates native ABI risk in replaceable helpers. A future Tauri shell remains possible because the UI and control plane communicate through stable protocols.

## Design principles

- No model receives direct filesystem, process, PTY, credential, or updater authority.
- All mutable repository writes continue through ForgeOS Tool Broker receipts.
- Terminal sessions are operator tools by default; agent-controlled terminal input requires an explicit governed capability.
- Secrets never enter browser JSON, logs, SSE events, crash reports, or provider public views.
- Updates are accepted only after HTTPS retrieval, Ed25519 signature verification, SHA-256 verification, version policy checks, and staged atomic replacement.
- Heavy UI assets are lazy-loaded. The dashboard can start without Monaco or xterm.
- Native helpers use line-delimited JSON-RPC with explicit request IDs, bounded frames, timeouts, and version negotiation.
- Every new side effect has a deterministic receipt or audit event.

## Embedded PTY

### Native protocol

`ForgePty.exe` communicates over stdin/stdout JSONL. It supports:

- `initialize`
- `session/create`
- `session/input`
- `session/resize`
- `session/snapshot`
- `session/terminate`
- `session/list`
- `shutdown`

Notifications:

- `session/output`
- `session/exit`
- `session/title`
- `session/error`

Each session contains:

- immutable session ID
- workspace root and current directory
- shell executable and argv
- columns and rows
- process ID
- state
- bounded ring buffer cursor
- creation and last-activity timestamps

### Security

The Node `TerminalService` validates all requested working directories with the same `WorkspacePolicy` used by Tool Broker. Shell executables must be in a configured allowlist. The browser cannot supply arbitrary environment variables. Only a minimal inherited environment plus configured safe variables reaches the PTY.

Agent tasks cannot type into operator terminals unless a task has `terminal.control` and an approval receipt. The initial UI supports operator-owned terminals only.

### Reliability and performance

- WebSocket frames are capped.
- Output is coalesced on a short timer before sending to the browser.
- The PTY helper keeps a bounded ring buffer for reconnect.
- Hidden terminal tabs stop rendering but continue buffering within limits.
- Sessions survive UI reload while the Node service remains alive.
- Launcher shutdown terminates helper process groups.
- Windows uses ConPTY and requires Windows 10 1809 or newer.

## Monaco workroom

### Loading strategy

The dashboard shell remains plain HTML/CSS/JS. Monaco is stored locally and loaded only when the Workroom editor is opened. No CDN is required. The AMD compatibility build is not used; the ESM editor and worker assets are copied during packaging.

### Editor capabilities

- Project file tree with lazy directory expansion.
- Multi-tab editor models keyed by canonical file URI.
- Syntax highlighting and built-in language services for JavaScript, TypeScript, JSON, CSS, and HTML.
- Find, replace, go-to-line, command palette, minimap toggle, word wrap, and keyboard shortcuts.
- Dirty-state tracking and model view-state restoration.
- Save through a content-hash precondition.
- Conflict response when the disk hash changed.
- Diff editor comparing the in-memory model with the current disk version.
- Read-only mode outside project write policy.
- File size and binary guards.
- Model disposal and least-recently-used eviction to bound memory.

### File API

The editor uses dedicated server endpoints:

- `GET /api/files/tree`
- `GET /api/files/read`
- `PUT /api/files/write`
- `GET /api/files/diff`

All file paths are resolved against a selected project. Writes use Tool Broker `fs.write` with `expectedHash`. The browser receives a content hash and never gets a direct OS file handle.

## Credential Vault

### Browser contract

The UI can:

- list credential aliases and metadata
- set or replace a credential
- delete a credential
- test whether a provider can resolve a credential

It cannot retrieve plaintext.

### Node contract

`CredentialVault` exposes:

```js
await vault.set({ service, account, secret })
await vault.resolve({ service, account })
await vault.list({ service })
await vault.delete({ service, account })
```

`resolve` is server-only. Provider configuration stores `secretRef` objects rather than API keys.

### Native storage

Windows release uses Windows Credential Manager through `ForgeCredential.exe`. Linux development uses Secret Service when available. Tests use an in-memory backend. There is no plaintext-file fallback in release mode; if the OS vault is unavailable, credential writes fail closed with a diagnostic.

### Redaction

Resolved secrets are added to request-local redaction sets. Provider errors, tool receipts, and audit events are scrubbed before persistence. Secret values are zeroed from mutable buffers where the runtime permits.

## Signed auto-update

### Update manifest

The updater consumes a signed manifest:

```json
{
  "schema": "forge.studio.update.v1",
  "channel": "stable",
  "version": "0.3.0",
  "publishedAt": "...",
  "minimumLauncherVersion": "0.3.0",
  "package": {
    "url": "https://.../ForgeStudio-0.3.0-windows-x64.zip",
    "bytes": 0,
    "sha256": "..."
  },
  "signature": "base64-ed25519-signature"
}
```

The signature covers canonical JSON excluding the `signature` field.

### Update flow

1. Launcher starts the current version.
2. Control plane checks at startup after a randomized delay and then at a bounded interval.
3. User can trigger `Check for updates`.
4. Manifest is fetched over HTTPS or from a local test endpoint.
5. Embedded public key verifies the manifest.
6. SemVer and rollout policy are checked.
7. Package downloads to a temporary file with a byte cap.
8. SHA-256 and ZIP path safety are verified.
9. Package is extracted to a sibling staging directory.
10. `PORTABLE-MANIFEST.json` is verified.
11. A pending-update marker is written.
12. On next restart, the launcher swaps directories atomically and preserves rollback state.
13. A post-update health check either commits the update or rolls back.

No update endpoint is enabled by default in source builds. Release builders must provide an endpoint and an Ed25519 public key. The private signing key never enters the source tree or release package.

## Interoperability intelligence

Forge Studio discovers project instructions from:

- `AGENTS.md`
- `CLAUDE.md`
- `FORGE.md`
- `.cursor/rules/*.mdc`
- `.windsurf/rules/*.md`
- `.windsurf/workflows/*.md`

The discovery service normalizes them into scoped Forge instruction records with provenance, glob activation, and trust labels. It never silently promotes them into ForgeOS policy. Selected records are included in ContextPack only when their scope matches the task.

Reusable workflows are exposed as operator-invoked mission templates. They do not run automatically without a mission creation event.

## Resource governor

A `ResourceGovernor` samples process RSS, event-loop delay, active agents, terminal output rates, open Monaco models, and WebSocket queue depth. It enforces:

- terminal output backpressure
- LRU editor model eviction
- maximum active terminals
- maximum active agent runs
- delayed repository reindexing under pressure
- provider concurrency limits
- brownout mode that disables optional previews and background refresh

The governor emits transitions, not high-frequency telemetry, to avoid log growth.

## Session recovery

The store persists terminal metadata, editor tabs, file hashes, layout, and pending update state. PTY process reattachment across full application restart is not promised because ConPTY handles are process-owned; instead Forge Studio restores terminal definitions and offers explicit restart. Agent missions continue to use existing durable checkpoints and interrupts.

## UI structure

The main navigation gains:

- Dashboard
- Workroom
- Missions
- Evidence
- Memory
- Providers
- Settings

Workroom contains:

- left: project tree
- center: editor or diff editor
- bottom: terminal tabs
- right: context/evidence inspector

Settings contains credential aliases, update channel/status, resource limits, and provider discovery.

## Testing strategy

- Node unit tests for file APIs, vault behavior, update verification, instruction discovery, resource governor, and terminal service protocol.
- Go unit tests for canonical update verification and helper request validation.
- Linux PTY integration test using the POSIX helper.
- Browser HTTP/UI contract tests verifying every visible control calls a real endpoint.
- Packaging tests verifying Monaco/xterm assets, native helpers, update public key, and no private key.
- Existing 96 Forge Studio and 389 ForgeOS tests remain mandatory.
- Staged-package smoke test exercises health, authenticated API, file read/write conflict, PTY create/output/terminate, and update manifest rejection.

## Release scope

Forge Studio 0.3 is complete when:

- embedded terminal works through a real PTY helper
- Monaco edits and saves real files with conflict protection
- Windows Credential Manager stores provider secrets through a native helper
- signed update manifests are verified and unsafe updates are rejected
- instruction discovery and resource governance are active
- all tests and staged smoke tests pass
- Windows x64 launcher and helper binaries are packaged

Out of scope for 0.3:

- voice
- cloud billing
- remote multi-tenant workspaces
- an extension marketplace
- full VS Code extension compatibility
- claiming superiority over Claude Code or Codex without benchmark evidence
