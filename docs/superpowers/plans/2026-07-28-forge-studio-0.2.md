# Forge Studio 0.2 Intelligence Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade Forge Studio into a stronger governed coding-agent harness with incremental repository intelligence, safe patch application, MCP interoperability, official Codex app-server integration, adaptive provider routing, durable interrupts, and local evaluation.

**Architecture:** Keep ForgeOS as the execution and evidence authority. Add small dependency-free protocol adapters and focused SQLite-backed services around the existing agent loop, then expose only wired capabilities through the local API and UI. Official coding CLIs remain credential owners; Forge Studio communicates through documented process protocols and never extracts their tokens.

**Tech Stack:** Node.js 22 ESM, node:sqlite, Git, Go Windows launcher, ForgeOS vendored runtime, JSON-RPC 2.0 over stdio, dependency-free browser UI.

## Global Constraints

- Windows 10/11 x64 remains the primary packaged target.
- No voice subsystem.
- No direct model-to-shell or model-to-filesystem path.
- No `shell: true`; all processes use executable plus argv.
- All writes are workspace-contained, hash-checked, and receipt-producing.
- Keep the default runtime dependency-free outside Node.js and Git.
- Do not copy AGPL Wigolo source into the MIT core.
- Every production behavior must have a failing test first.
- Do not claim superiority over Claude Code or Codex without a reproducible benchmark.

---

### Task 1: Incremental Repository Intelligence

**Files:**
- Create: `src/repository/repository-index.mjs`
- Create: `tests/repository-index.test.mjs`
- Modify: `src/storage/studio-store.mjs`

**Produces:** `RepositoryIndex.index()`, `RepositoryIndex.search()`, `RepositoryIndex.contextForTask()`.

- [ ] Test deterministic tracked-file indexing, content-hash reuse, symbol extraction, ignored secrets/binaries, and ranked context selection.
- [ ] Implement SQLite tables and incremental indexer using `git ls-files` with bounded filesystem fallback.
- [ ] Verify focused tests and full suite.

### Task 2: Conflict-Safe Patch Engine

**Files:**
- Create: `src/execution/unified-patch.mjs`
- Create: `tests/unified-patch.test.mjs`
- Modify: `src/execution/tool-broker.mjs`
- Modify: `src/agent/agent-loop.mjs`

**Produces:** `parseUnifiedPatch()`, `applyUnifiedPatch()`, governed `fs.patch` tool.

- [ ] Test multi-hunk patches, expected hashes, path traversal rejection, newline handling, conflict reporting, and atomic receipt generation.
- [ ] Implement parser and minimal patch application.
- [ ] Register `fs.patch` in agent tool schemas and verify all tests.

### Task 3: Governed MCP Client

**Files:**
- Create: `src/mcp/stdio-mcp-client.mjs`
- Create: `src/mcp/mcp-registry.mjs`
- Create: `tests/mcp-client.test.mjs`

**Produces:** bounded stdio JSON-RPC client for initialize, tools/list, tools/call, cancellation, schema caching, and process cleanup.

- [ ] Test handshake, deterministic tool cache, calls, errors, timeout, cancellation, and secret-free public views with a fixture server.
- [ ] Implement process protocol without shell invocation.
- [ ] Verify focused tests and full suite.

### Task 4: Codex App-Server Protocol Adapter

**Files:**
- Create: `src/providers/codex-app-server.mjs`
- Create: `tests/codex-app-server.test.mjs`
- Modify: `src/providers/provider-registry.mjs`

**Produces:** official JSONL app-server client supporting initialize, account/read, thread start/resume, turn start, event streaming, interruption, and approval callbacks.

- [ ] Test protocol framing, correlation, notifications, overload retry classification, approval requests, cancellation, and clean shutdown with a fixture.
- [ ] Implement documented stable app-server surface.
- [ ] Register a secret-free Codex app-server provider profile.

### Task 5: Adaptive Provider Router

**Files:**
- Create: `src/providers/adaptive-router.mjs`
- Create: `tests/adaptive-router.test.mjs`
- Modify: `src/providers/provider-registry.mjs`
- Modify: `src/agent/agent-loop.mjs`

**Produces:** capability/availability/cost/latency scoring and deterministic fallback chain.

- [ ] Test policy constraints, deterministic ties, failure cooldown, local-first mode, and explicit provider override.
- [ ] Implement capability metadata and router.
- [ ] Integrate selection and fallback events into agent runs.

### Task 6: Durable Interrupts and Idempotent Resume

**Files:**
- Create: `src/orchestration/interrupts.mjs`
- Create: `tests/interrupts.test.mjs`
- Modify: `src/storage/studio-store.mjs`
- Modify: `src/orchestration/mission-runner.mjs`

**Produces:** persisted interrupt records, one-time resume tokens, idempotency keys, and reconciliation states.

- [ ] Test pause, duplicate resume rejection, crash-safe readback, side-effect idempotency, and expiry.
- [ ] Implement storage and mission-runner integration.
- [ ] Verify all tests.

### Task 7: Context Integration

**Files:**
- Modify: `src/agent/context-builder.mjs`
- Modify: `src/agent/agent-loop.mjs`
- Create: `tests/context-intelligence.test.mjs`

**Produces:** repository-ranked code slices and omission reasons inside Forge ContextPacks.

- [ ] Test bounded context, stable ordering, changed-file boost, dependency-neighbor boost, and secret exclusion.
- [ ] Integrate repository intelligence before each model run.
- [ ] Verify all tests.

### Task 8: Evaluation Harness

**Files:**
- Create: `src/eval/eval-runner.mjs`
- Create: `scripts/run-evals.mjs`
- Create: `tests/eval-runner.test.mjs`
- Create: `evals/smoke-suite.json`

**Produces:** reproducible local task evaluation with pass rate, tool count, elapsed time, token estimate, retry count, and evidence completeness.

- [ ] Test fixture execution, timeout, scoring, deterministic report hash, and provider comparison.
- [ ] Implement runner and CLI report generation.
- [ ] Verify focused tests.

### Task 9: API and UI Integration

**Files:**
- Modify: `src/server/routes.mjs`
- Modify: `src/server/http-server.mjs`
- Modify: `src/app.mjs`
- Modify: `ui/index.html`
- Modify: `ui/app.js`
- Modify: `ui/style.css`
- Modify: `tests/http-ui.test.mjs`

**Produces:** real endpoints for repository indexing/search, MCP status/tools, provider routing, interrupts, and evaluations.

- [ ] Extend HTTP tests before implementation.
- [ ] Wire services through the composition root.
- [ ] Add only functioning controls and status views.
- [ ] Verify API/UI and full suite.

### Task 10: Release 0.2.0

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/SECURITY.md`
- Modify: `docs/RESEARCH-NOTES.md`
- Modify: `docs/USER-GUIDE.md`
- Modify: `scripts/build-portable.mjs`
- Modify: `scripts/generate-manifest.mjs`
- Modify: `launcher/main.go`
- Modify: `tests/packaging.test.mjs`

**Produces:** source ZIP, Windows x64 bootstrap ZIP, native launcher EXE, manifests, checksums, benchmark report, and truthful release notes.

- [ ] Update version and documentation with implemented limits.
- [ ] Run Studio tests, ForgeOS tests, validation, evals, smoke, portable dependency-closure test, Go tests/build, ZIP integrity, PE inspection, and checksum verification.
- [ ] Export only changed/generated artifacts and update `project-manifest.json`.
