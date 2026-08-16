# Changelog

This changelog starts at the canonical product baseline. Earlier development checkpoints are intentionally not part of the public release history.

## 0.0.0 — 2026-08-16

First canonical Nolane Agent release baseline.

### Product
- Unified local-first desktop agent workspace with Projects, Missions, Activity, Review, Studio, Browser, Skills, Settings and Control Plane surfaces.
- Evidence-oriented execution semantics for model turns, tools, permissions, recovery and review.
- Multi-provider routing, model management, MCP/browser gateways and subagent orchestration.

### Reliability
- Added structured cancellation for parallel subagent graph waves so sibling work is aborted and settled when a child fails.
- Added permanent regression contracts for model lifecycle events and subagent cancellation.

### Release engineering
- Reset canonical version identity to 0.0.0 / stable.
- Added clean multi-platform CI, security scanning and immutable v0.0.x release workflow.
- Release assets include SHA-256 checksums and a machine-readable release manifest.
- Update feed remains disabled by default until verified signing evidence is configured.
