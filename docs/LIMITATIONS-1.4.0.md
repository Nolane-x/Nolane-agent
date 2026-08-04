# Forge Studio 1.4.0 — remaining limits

Date: 2026-07-29

The item-level source of truth is `feature-audit-1.4.0.json`. Source and automated tests do not prove external infrastructure availability.

## Agent Operations Center boundary

- Provider quality, cost, and latency values are routing tiers, not live billing totals.
- MCP tools are inventoried but cannot be invoked manually from this dashboard; execution remains task- and capability-governed.
- Capability grant creation supports the complete API model, but large enterprise approval workflows still belong to RBAC/SSO policy administration.
- Agent/task state is operational inventory, not a complete trace viewer or distributed fleet scheduler.
- Secret values, provider commands, environment variables, profile prompts, and raw tool schemas are deliberately unavailable to the browser.

## Remaining local gaps

- Dedicated trace, dependency graph, context, memory, cost, secret, and sandbox administration surfaces remain incomplete.
- Embedded tree-sitter parse forests, language-general AST query/patch, complete inheritance graph, and issue-to-code indexing remain incomplete.
- CPU, RAM, process-count, and disk quotas are not enforced natively on every local OS.
- Podman, Windows Job Objects/AppContainer, and production macOS Seatbelt profiles remain incomplete.
- Dedicated open-worktree-in-IDE and remote-to-local task handoff workflows remain incomplete.

## External gates

Authenticode, Apple notarization, native validation on every supported OS, live multi-tenant cloud conformance, enterprise IdP/SCIM conformance, public marketplace approval, and an independently operated comparative benchmark remain external gates.
