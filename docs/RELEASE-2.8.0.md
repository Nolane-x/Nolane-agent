# Forge Studio 2.8.0 release notes

## Completion release

Forge Studio 2.8.0 removes the final `not_implemented` classifications from the 790-item audit without converting unavailable native infrastructure into false production claims.

## Integrated Browser

A lazy-loaded Integrated Browser Center now exposes the existing governed browser runtime through authenticated project-bound open, navigation, snapshot, tab, screenshot, close, and status operations. Only HTTP and HTTPS URLs are accepted, URL credentials are rejected, page content remains untrusted evidence, and no browser credential injection surface is added.

## Secrets Manager

A lazy-loaded Secrets Manager now provides explicit set, metadata-only list, and delete operations over the existing credential vault. Secret values use password inputs and are never returned by list operations or rendered after storage. The UI contains no reveal, resolve, or plaintext export action.

## Tree-sitter runtime contract

Forge Studio now includes a project-bound Tree-sitter CLI runtime service and authenticated parse API. The service verifies the external CLI version, resolves source files through real paths inside a known project, rejects traversal and unsupported files, bounds output, requires JSON parse evidence, and emits content-addressed receipts.

Tree-sitter remains externally gated in this Linux release environment because the pinned CLI and language grammar runtime are not bundled or independently operated by the release runner.

## Native sandbox driver contracts

Forge Studio now includes fail-closed drivers for:

- rootless Podman containers with no-new-privileges, dropped capabilities, read-only root filesystem, network deny by default, bounded CPU/RAM/process settings, and a managed workspace mount;
- Windows Job Objects through a bounded native-helper protocol that is usable only on Windows;
- macOS `sandbox-exec` profiles with deny-default and network-deny defaults that are usable only on macOS.

The Sandbox Manager reports capability probe results and reasons. No HTTP endpoint exposes arbitrary Podman creation, Job Object PID attachment, or `sandbox-exec` execution.

## Audit movement

- 4.21 — Trình duyệt tích hợp: `verified_source_test`
- 4.30 — Trình quản lý secrets: `verified_source_test`
- 13.27 — Hỗ trợ tree-sitter: `external_gate`
- 21.4 — Hỗ trợ Podman: `external_gate`
- 21.6 — Hỗ trợ Windows Job Objects: `external_gate`
- 21.7 — Hỗ trợ macOS sandbox: `external_gate`

The audit target is 643 verified, 91 partial, 56 external-gated, and 0 not implemented out of 790. External-gated items remain open until their required runtime or platform evidence is operated and captured.
