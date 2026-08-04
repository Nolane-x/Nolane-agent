# Forge Studio 1.6.0 — remaining limits

Date: 2026-07-29

The item-level source of truth is `feature-audit-1.6.0.json`. Source and automated tests do not prove external infrastructure availability.

## Trace & Evidence boundary

- The graph derives relationships only from known receipt and artifact hash fields; it does not infer undocumented semantic causality.
- Failure clustering is deterministic normalization, not an ML root-cause oracle.
- Evidence exports preserve the bounded project snapshot available to the service; they do not include private chain-of-thought, raw provider prompts, terminal stdin, environment values, or secret material.
- Export artifacts are content-addressed and integrity checked, but external archival retention remains an operator responsibility.

## Remaining local gaps

- Dedicated dependency graph, cost, secret, and sandbox administration surfaces remain incomplete.
- Embedded tree-sitter parse forests, language-general AST query/patch, complete inheritance graph, and issue-to-code indexing remain incomplete.
- CPU, RAM, process-count, and disk quotas are not enforced natively on every local OS.
- Podman, Windows Job Objects/AppContainer, and production macOS Seatbelt profiles remain incomplete.
- Dedicated open-worktree-in-IDE and remote-to-local task handoff workflows remain incomplete.

## External gates

Authenticode, Apple notarization, native validation on every supported OS, live multi-tenant cloud conformance, enterprise IdP/SCIM conformance, public marketplace approval, and an independently operated comparative benchmark remain external gates.
