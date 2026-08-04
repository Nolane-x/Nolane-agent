# Forge Studio 1.0.0 release notes

Date: 2026-07-29

## Stable adaptive coding-agent platform identity

Forge Studio 1.0.0 establishes one stable release identity across the runtime, launcher, Remote MCP server, LSP/MCP clients, desktop package, VS Code extension, TypeScript SDK, Python SDK, project manifest, audit, documentation, update payload, and release archives.

The tracked `config/release-identity.json` file is the authority for product name, stable semantic version, release channel, and artifact prefixes. The full release matrix contains a fail-closed `version-coherence` gate; a release is rejected if any public surface differs from the authority.

## Included platform capabilities

- Governed local-first agent loop with lifecycle hooks, task contracts, capability approvals, receipts, verification claims, checkpoint/rewind/fork, and scoped subagents.
- Hybrid lexical/semantic repository intelligence, repository map, LSP diagnostics/definitions/references, symbol-aware edits, advanced search, dynamic context artifacts, progressive tool loading, and durable context history.
- Outcome-aware model router, cited project memory, independent incremental reviewer, bounded self-fix, typed Git/worktree integration, CLI, Python/TypeScript SDKs, VS Code extension, visual evidence, and durable local automation.
- Governed Environment Self-Healing Supervisor with PID ownership, health probes, bounded restart/backoff, bootstrap cache, port conflict protection, secret reinjection requirements, capability-controlled mutations, and verification evidence.
- ForgeOS 0.6.1 remains vendored with a content-addressed manifest and fresh-source reconstruction gate.

## Release boundary

Forge Studio 1.0.0 is a stable source and local Windows-bootstrap release identity. Authenticode, Apple notarization, live multi-tenant cloud conformance, external enterprise interoperability, marketplace acceptance, native evidence on every supported OS, and an independently operated comparative benchmark remain external gates. They are not reported as satisfied without real signed evidence.
