# Workspace Trust & Governance Center Design

## Goal

Prevent untrusted repositories from automatically loading executable or behavior-shaping project content, while giving users a professional control center to review, trust, and revoke each workspace identity.

## Architecture

A SQLite-backed `WorkspaceTrustService` computes a stable workspace identity from the canonical root and filesystem identity. Trust decisions are bound to that identity, actor, reason, and audit receipt. A replacement directory at the same path becomes untrusted.

The service gates project instructions, lifecycle hooks, plugin context, MCP schemas/calls, agent profiles/skills, background missions, and workspace bootstrap. Read-only repository inspection remains available. Deny is the default.

The HTTP API exposes status, audit, trust, and revoke operations under authenticated principals. The UI lazy-loads a Workspace Trust Center showing blocked surfaces, identity evidence, decision history, and explicit trust/revoke controls.

## Security properties

- No project-supplied instructions, hooks, profiles, plugins, MCP tools, or background execution before trust.
- Trust is bound to the current filesystem identity, not only the path string.
- Repository replacement invalidates an old decision.
- Decisions require an authenticated principal and a human-readable reason.
- Audit records and public responses exclude secrets.
- Revocation takes effect immediately.
- Read-only file/repository inspection remains possible before trust.

## Testing

Unit tests cover persistence, identity replacement, revocation, and receipts. Integration tests cover AgentLoop instruction/hook/MCP/plugin gating, API authentication, and UI controls. The full release matrix must pass before release.
