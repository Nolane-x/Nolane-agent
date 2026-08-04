# NolaneNative-Native Waves 6–19 Checkpoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Convert residual NolaneNative behavioral contracts into Nolane-owned local core implementations through Wave 15, then preserve Waves 16–19 as fail-closed external certification gates.

**Architecture:** Decompose upstream-path ownership into named behavioral contracts, implement each local runtime behind typed orchestration and authenticated HTTP entrypoints, and bind every verified contract to direct, negative, production-wiring and parity-mapping tests. External Windows, provider and integration evidence is represented by a strict checkpoint and receipt verifier rather than mocks.

**Tech Stack:** Node.js 22 ESM, node:test, JSON contract catalogs, Nolane orchestration service, authenticated server routes, SHA-256 evidence receipts.

## Global Constraints

- Clean-room behavioral rewrite; do not copy NolaneNative implementation source.
- No verified status from file existence alone.
- Credential-reference-only; no raw secrets in config, logs, snapshots or receipts.
- Fail closed for unavailable remote backends, providers, browser writes and integrations.
- `completeParityClaimAllowed=false` until every external contract and Nolane acceptance gap is closed with real evidence.

---

- [x] Wave 6: remove residual catch-all contracts; enforce single-owner path mapping, zero empty contracts and Nolane-owned entitlement policy.
- [x] Wave 7: implement execution backend TCK, local process backend, bounded dispatch, daemon/watchdog and artifact transfer.
- [x] Wave 8: implement durable 10k-session resume, public/hidden separation, correction/undo, compression lineage, drift and leases.
- [x] Wave 9: implement provider/ACP protocol normalization, streaming, tool assembly, retries, cancellation and usage receipts.
- [x] Wave 10: implement gateway lifecycle and common messaging adapter TCK with idempotency, pairing and attachment hashes.
- [x] Wave 11: implement browser policy engine, approval, selector/snapshot logic, quarantine, recovery and replay receipts.
- [x] Wave 12: implement local memory, signed plugin, scheduler, Kanban and observability adapter frameworks.
- [x] Wave 13: implement secret provider TCK, PKCE/OAuth, revoke downgrade, reauthentication and pairing.
- [x] Wave 14: implement content-addressed media, provider TCK, recorder, VAD, TTS streaming and barge-in.
- [x] Wave 15: implement shared product state and versioned configuration projection for Electron/web/TUI/CLI/VS Code.
- [x] Waves 16–19: create deterministic fail-closed checkpoint, strict real-receipt verifier and stable-release claim lock.
- [x] Regenerate native-core catalog, Master Acceptance Ledger and deterministic checkpoint reports.
- [x] Extend beta.6 checkpoint matrix from 134 to 145 required gates.
- [x] Run targeted Wave 6–19 tests, full parallel Node regression and isolated packaging/integration lanes.
- [ ] Run external Windows 11, signed installer, accessibility, provider-real, messaging, remote execution and dogfood certification lanes.
- [ ] Unlock Nolane 5.0.0 stable only after external contracts and acceptance gaps reach zero and independent review passes.
