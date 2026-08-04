# Forge Studio 1.1.0 — remaining limits

Date: 2026-07-29

The item-level source of truth is `feature-audit-1.1.0.json`. Local source and contract tests do not prove external infrastructure or third-party service availability.

## NolaneNative sidecar limits

- NolaneNative requires a compatible Python runtime and its Python dependencies before ACP readiness can pass.
- Forge vendors an immutable upstream source snapshot, not NolaneNative cloud infrastructure or external account credentials.
- NolaneNative skills, messaging gateways, browser providers, media providers, and scheduled jobs are capability inventory until their dependencies and explicit permissions are satisfied.
- Sidecar lifecycle is local and governed; production remote execution remains a separate external gate.

## Remaining local implementation gaps

- Several dedicated administration views remain incomplete, including full trace, dependency-graph, model, MCP, secret, and sandbox management surfaces.
- Embedded tree-sitter parse forests, a language-general AST query/patch engine, complete inheritance graph, and issue-to-code index remain incomplete.
- CPU, RAM, process-count, and disk quotas are not enforced natively on every local operating system.
- Podman, Windows Job Objects/AppContainer, and production macOS Seatbelt profiles are not complete end to end.
- Dedicated “open worktree in selected IDE” and remote-to-local task handoff workflows remain incomplete.

## External gates

Authenticode, Apple notarization, native release validation on every supported OS, real multi-tenant cloud conformance, enterprise IdP/SCIM conformance, public marketplace approval, and an independently operated comparative benchmark remain external gates.
