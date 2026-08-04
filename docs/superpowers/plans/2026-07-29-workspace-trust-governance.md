# Workspace Trust & Governance Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans and TDD. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent deny-first workspace trust enforcement and a professional governance UI.

**Architecture:** A SQLite trust service binds decisions to canonical filesystem identity. Thin wrappers gate behavior-shaping project content in AgentLoop and runtime services. Authenticated APIs and a lazy UI expose decisions and audit evidence.

**Tech Stack:** Node.js ESM, node:sqlite, node:test, existing Forge HTTP/UI architecture.

## Global Constraints

- Default untrusted.
- Read-only repository inspection remains available.
- Trust decisions require authenticated principals.
- No secret values in audit or API output.
- Full release matrix must pass.

### Task 1: Persistent trust service
- [ ] Write failing unit tests for default denial, trust persistence, identity replacement, revoke, and receipts.
- [ ] Implement SQLite store and trust service.
- [ ] Run focused tests.

### Task 2: Runtime gates
- [ ] Write failing AgentLoop and gateway tests.
- [ ] Gate instructions, hooks, plugin context, MCP, agent profiles, and background runs.
- [ ] Run focused tests.

### Task 3: API and UI
- [ ] Write failing HTTP and UI tests.
- [ ] Add authenticated trust APIs and lazy Workspace Trust Center.
- [ ] Run focused tests.

### Task 4: Release
- [ ] Update version to 1.2.0, docs, manifest, and release matrix trust gate.
- [ ] Run full Node suite.
- [ ] Commit clean source.
- [ ] Run the full release matrix from the beginning.
