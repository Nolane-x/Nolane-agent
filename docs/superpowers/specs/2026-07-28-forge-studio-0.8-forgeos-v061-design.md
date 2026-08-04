# Forge Studio 0.8 — ForgeOS v0.6.1 Integration Design

## Goal

Produce one auditable source release that recovers the implemented 0.7 enterprise/cloud code, synchronizes the newly supplied ForgeOS tree, exposes its strongest truthful capabilities to agents, and publishes a conservative checklist audit for the 28 requested feature groups.

## Architecture

Forge Studio remains the product runtime and UI. ForgeOS remains the authority for routing, execution-graph compilation, context isolation, review scope, harness capability declarations, agent-surface security, skill intake, universal lanes, evidence and remote sandbox receipt verification.

A new `ForgeOsToolGateway` is the only model-visible adapter. It exposes strict JSON schemas, separates read-only planning/security tools from external execution, emits redacted content-addressed receipts, and hides remote execution unless the task has an explicit one-time capability. The existing AgentLoop dispatches ForgeOS tools before falling back to the local filesystem/process broker.

The remote microVM surface is provider-based. Forge Studio never calls it a microVM unless the configured HTTPS provider publishes the required capability document and signs a request-bound Ed25519 receipt. An unavailable or misconfigured provider remains visible as such and cannot execute.

## Components

1. **Recovered 0.7 source** — enterprise OIDC/SCIM/RBAC, durable cloud queue, Kubernetes sandbox driver, remote MCP HTTP/OAuth, plugin signing/transparency, benchmark claim gate.
2. **Vendored ForgeOS snapshot** — exact supplied v0.6.1 tree including universal lanes, skill intake, deterministic fabric, context kernel v2, review/security surfaces and remote microVM contract.
3. **ForgeOS bridge** — stable product API around status, lanes, execution graph, review scope, work-unit contexts, harness profiles, security scans, skill intake and remote sandbox.
4. **ForgeOS tool gateway** — model-facing schemas, policy, receipts and task-scoped execution grants.
5. **AgentLoop integration** — progressive schema exposure, dispatch, evidence recording and observable events.
6. **HTTP diagnostic surface** — authenticated local endpoints for status, lanes and remote sandbox readiness; no execution endpoint without the normal governed task path.
7. **Feature audit** — machine-readable and human-readable mapping of every item in the supplied 28-section checklist to implemented, partial, external-gated or missing.

## Security and trust boundaries

- No shell strings for ForgeOS or sandbox execution.
- No private key or secret is placed in model context, receipts, logs or the feature audit.
- Agent-surface and skill-intake tools treat their input as untrusted data.
- Candidate skills remain candidate/quarantined; Studio cannot self-promote them.
- Physical, financial, production and remote execution remain human-approved.
- Benchmark superiority remains false without signed independent receipts over common tasks.
- Build/signing/notarization status is reported independently from source implementation status.

## Error handling

All gateway failures return a stable error code and a redacted reason. Remote sandbox probe states are `ready`, `unavailable` or `misconfigured`. Invalid schemas, unsafe skill packages, blocked agent surfaces and unsupported execution boundaries fail closed. Receipts are produced only for completed gateway calls.

## Testing

- Preserve the recovered 0.6 baseline suite.
- Add direct ForgeOS v0.6.1 bridge tests.
- Add gateway schema, policy, receipt and remote-sandbox tests.
- Add AgentLoop progressive-exposure and dispatch tests.
- Add app wiring and HTTP diagnostic tests.
- Run the vendored ForgeOS tests that cover the synchronized features.
- Run Node syntax, smoke, eval, Go tests and package validation.

## Explicit non-claims

This release does not claim every checklist line is production-complete. It does not claim an independently operated cloud, signed public binaries, notarized macOS binaries, a verified JetBrains Marketplace release, or superiority over Codex/Claude Code without external evidence.
