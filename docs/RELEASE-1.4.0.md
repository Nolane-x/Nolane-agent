# Forge Studio 1.4.0 release notes

Date: 2026-07-29

## Agent Operations Center

Forge Studio 1.4.0 adds a professional, lazy-loaded operations surface backed by one bounded server snapshot. It exposes model readiness, provider capability and routing tiers, progressive tool inventory, MCP servers and namespaced tools, capability definitions and grants, operating/adaptive plane status, and project-scoped mission, task, and custom-agent profile state.

The Control Center performs real operations rather than rendering static configuration: providers can be re-detected, capability grants can be created with explicit scope/reason/impact, and active grants can be revoked. All writes reuse the authenticated capability API; the UI never stores provider or API credentials.

## Safety properties

- The server uses field allowlists instead of forwarding provider, MCP, grant, mission, or task objects directly.
- Executables, argv, environment variables, tool input schemas, internal metadata, profile prompts, and secrets are omitted.
- Mission and task inventories are filtered by the selected project.
- Project agent profiles degrade to a bounded blocked state when workspace trust denies profile loading.
- Arrays and strings have hard response limits and the aggregate receives a canonical SHA-256 receipt.
- The management module and CSS are loaded only when the user opens the center, preserving the eager UI budget.

## Release matrix

The mandatory matrix adds `agent-operations-governance` to the existing version, NolaneNative, workspace-trust, diff-review, runtime, ForgeOS, SDK, IDE, audit, benchmark, reconstruction, packaging, and archive-integrity gates.
