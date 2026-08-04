# ForgeOS v0.6 Protocol Contracts

ForgeOS exposes the same domain services through MCP, A2A, HTTP, CLI, and Studio. Public responses are validated against generated JSON Schemas before they are committed or returned.

## MCP

The server implements the MCP `2025-11-25` lifecycle with initialization, protocol negotiation, session ownership, Origin validation, input/output validation, notifications, bounded sessions, and stable error codes. Stdio and Streamable HTTP call the same tool registry. The v0.6 server advertises 50 tools.

New strict v0.6 tools:

```text
forge_v06_status
forge_execution_graph_compile
forge_review_scope_compile
forge_context_work_units_compile
forge_harness_profile_plan
forge_agent_surface_scan
```

They join project, artifact, evidence, finding, recovery, federation, Skill Intelligence, and MCP broker tools. Their schemas are generated from `src/v06/schemas.mjs` into the public `schemas/` directory.

## A2A

The A2A 1.0 surface supports Agent Card discovery, `SendMessage`, `GetTask`, `ListTasks`, and `CancelTask`. Tasks have persisted ownership, revision, transition history, lease, heartbeat, retry budget, cancellation, and stale-worker fencing. A2A streaming and push notification remain outside v0.6.

## Agent Skills and federation

First-party and external skill providers use immutable source coordinates, provider digests, tenant scope, maturity, license, scan, evaluation receipts, and explicit capability mappings. Materialization loads only selected sections and never executes scripts automatically.

## CLI and Studio

The `forge` CLI and Forge Studio call the same Skill Intelligence and v0.6 services as MCP. They do not maintain a parallel router. Studio can use the host bridge or negotiate same-origin MCP when opened standalone.

## Conformance boundary

Nine adapter configurations are protocol-tested by spawning the stdio server and completing the MCP lifecycle. Six additional adapters are documentation-only. This evidence is not vendor certification. See [Adapters](ADAPTERS.md) and [Claims Boundary](CLAIMS-BOUNDARY-V0.6.md).
