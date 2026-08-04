# Forge Studio 1.2.0 — remaining limits

Date: 2026-07-29

The item-level source of truth is `feature-audit-1.2.0.json`. Local source and contract tests do not prove external infrastructure or third-party service availability.

## Workspace trust boundary

- Trust is bound to the canonical workspace and Git filesystem identity; it is not a malware verdict or code-signing certificate.
- Safe read-only inspection remains available before trust, but project-provided behavior and background execution remain blocked.
- Repository content changed inside the same filesystem identity is handled by normal file hashes, instruction reload, task scope, capability policy, and verification; trust is intentionally not revoked on every ordinary edit.
- Enterprise organization-wide trust distribution and hardware-backed attestation remain separate future controls.

## Remaining local implementation gaps

- Several dedicated administration views remain incomplete, including full trace, dependency-graph, model, MCP, secret, and sandbox management surfaces.
- Embedded tree-sitter parse forests, a language-general AST query/patch engine, complete inheritance graph, and issue-to-code index remain incomplete.
- CPU, RAM, process-count, and disk quotas are not enforced natively on every local operating system.
- Podman, Windows Job Objects/AppContainer, and production macOS Seatbelt profiles are not complete end to end.
- Dedicated “open worktree in selected IDE” and remote-to-local task handoff workflows remain incomplete.

## External gates

Authenticode, Apple notarization, native release validation on every supported OS, real multi-tenant cloud conformance, enterprise IdP/SCIM conformance, public marketplace approval, and an independently operated comparative benchmark remain external gates.
