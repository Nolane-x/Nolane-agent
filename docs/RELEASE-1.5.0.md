# Forge Studio 1.5.0 release notes

Date: 2026-07-29

## Context & Memory Center

Forge Studio 1.5.0 adds a futuristic, lazy-loaded management surface for durable conversation and terminal history, content-addressed context artifacts, pinned evidence, project memory citations, TTL, freshness state, and role-specific context budgets.

The server aggregates only project-scoped allowlisted fields. Local artifact paths and memory backing-file paths never cross into the browser. Artifact content is read in bounded byte pages, and history search returns exact archive matches rather than loading entire logs.

## Governed actions

- Pin and unpin a context artifact with authenticated actor and SHA-256 receipt.
- Open and page through an artifact using the existing integrity-checked context store.
- Search durable conversation and terminal history.
- Verify memory freshness against citation hashes and TTL.
- Approve candidate memory with an evidence receipt, revoke active knowledge, and permanently purge only after revocation.
- Inspect separate planner, executor, reviewer, debugger, and subagent context budgets.

## Release matrix

The mandatory matrix adds `context-memory-governance` to the existing version, NolaneNative, workspace-trust, diff-review, agent-operations, runtime, ForgeOS, SDK, IDE, audit, benchmark, reconstruction, packaging, and archive-integrity gates.

## Visual and performance envelope

The Context & Memory Center uses a holographic aurora/grid layer, live-state glow, evidence cards, and dynamic role-budget meters. Motion is disabled when `prefers-reduced-motion: reduce` is active. The default eager shell has a 160 KB ceiling, while Runtime, Trust, Diff Review, Operations, and Context/Memory centers remain dynamically imported.
