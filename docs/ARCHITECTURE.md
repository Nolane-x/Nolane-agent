# Architecture

Nolane Agent is organized around one rule: **models propose; governed systems decide what may execute; evidence records what actually happened.**

## Runtime layers
1. **Application boundary** — HTTP/Electron entry points, project lifecycle and persistence.
2. **Agent loop** — context construction, provider selection, bounded model turns, retries, tool-call handling and completion claim assessment.
3. **Execution plane** — workspace-scoped file/process tools, browser/MCP gateways, permission checks and receipts.
4. **Subagent plane** — capability intersection, concurrency leases, dependency graphs, structured cancellation and handoff envelopes.
5. **Model plane** — provider registry, adaptive routing, health and policy, local-model management and model truth surfaces.
6. **Evidence/review plane** — events and receipts used for runtime recovery, review and verification. Runtime recovery state is not release-history documentation.
7. **Desktop/UI plane** — Electron host plus generated renderer assets and progressive experience regimes.

## Failure semantics
Cancellation, budget exhaustion, provider failure, blocked permissions and unverifiable completion claims are first-class states. A model saying “done” is not verification. Parallel graph failure cancels sibling work before the graph returns the failure.

## State ownership
Persistent project/task/run state lives in the storage layer. External providers never become the source of truth for local execution state. Generated UI output is built from source and should not be hand-edited to bypass quality gates.
