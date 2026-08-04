# Checkpoint 12 — Sovereign Agent Kernel

## Purpose

Checkpoint 12 turns Nolane's advanced but distributed agent subsystems into one durable execution backbone.

## New source modules

- `src/kernel/kernel-utils.mjs`
- `src/kernel/thread-ledger.mjs`
- `src/kernel/context-compiler.mjs`
- `src/kernel/reviewer-boundary.mjs`
- `src/kernel/capability-lease-authority.mjs`
- `src/kernel/speculative-execution-fabric.mjs`
- `src/kernel/sovereign-agent-kernel.mjs`
- `src/kernel/index.mjs`

## Runtime integration

`src/app.mjs` creates one kernel and adapts each execution lane to the existing production `AgentLoop`, workspace service, Git gateway, tool broker, model router, hooks, memory, skills/plugins and MCP runtime. `src/server/http-server.mjs` and `src/server/routes.mjs` expose the kernel through authenticated API routes.

## Durable state

The kernel SQLite database stores threads, event timelines, checkpoints and signed artifacts. Signed plans, context packets, execution receipts and capability leases are rehydrated after restart.

## UI

The Control Plane adds the `Agent Kernel` domain and renders live snapshot data. The visual language is dark, dense and evidence-oriented, with explicit status for concurrency, context use, capability leases and reviewer separation.

## Verification commands

```bash
npm run build:ui-v3
node --test \
  tests/sovereign-thread-ledger.test.mjs \
  tests/sovereign-context-compiler.test.mjs \
  tests/sovereign-capability-leases.test.mjs \
  tests/sovereign-execution-fabric.test.mjs \
  tests/sovereign-agent-kernel.test.mjs \
  tests/sovereign-kernel-restart-durability.test.mjs \
  tests/sovereign-kernel-http-api.test.mjs \
  tests/ui-v3-sovereign-agent-kernel.test.mjs
npm test
```

## API summary

```text
GET  /api/sovereign-kernel/health
GET  /api/sovereign-kernel/snapshot
GET  /api/sovereign-kernel/threads
POST /api/sovereign-kernel/threads
GET  /api/sovereign-kernel/threads/:id
GET  /api/sovereign-kernel/threads/:id/timeline
POST /api/sovereign-kernel/threads/:id/context
POST /api/sovereign-kernel/threads/:id/plans
POST /api/sovereign-kernel/threads/:id/capabilities
POST /api/sovereign-kernel/threads/:id/checkpoints
POST /api/sovereign-kernel/threads/:id/transition
POST /api/sovereign-kernel/plans/:id/execute
POST /api/sovereign-kernel/capabilities/:id/decision
POST /api/sovereign-kernel/capabilities/:id/revoke
POST /api/sovereign-kernel/checkpoints/:id/resume
```
