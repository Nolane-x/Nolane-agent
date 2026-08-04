# Forge Studio 1.4.0 verification contract

Date: 2026-07-29

The required command is:

```bash
npm run release:matrix
```

Evidence is written to `release/matrix-1.4.0/`, bound to the exact Git commit, and every required gate must pass.

## Agent Operations Center evidence

- Bounded and project-scoped aggregation of provider, tool, MCP, capability, mission, task, and profile state.
- Explicit allowlist serialization that excludes credentials, command arguments, environments, metadata, prompts, and raw schemas.
- Authenticated HTTP endpoint that binds the snapshot to the real request principal.
- Real provider detection and capability grant/revoke actions through existing governed APIs.
- Lazy-loaded professional UI with Models, Tools, MCP, Permissions, and Agents panels.
- Dedicated `agent-operations-governance` release gate.

## Complete release boundary

The matrix also runs the full Node suite, syntax validation, authenticated smoke, deterministic evaluation, VS Code source build, Go modules, Python SDK, ForgeOS validation and conformance, the item-level 790-feature audit, benchmark claim lock, manifest generation, Windows bootstrap, source/IDE packaging, fresh-source reconstruction, and archive integrity.
