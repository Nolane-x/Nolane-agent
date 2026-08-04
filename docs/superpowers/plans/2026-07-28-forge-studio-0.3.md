# Forge Studio 0.3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a lightweight native workroom with an embedded PTY, Monaco editor, OS-backed credentials, signed updates, instruction interoperability, and resource governance while preserving ForgeOS authority.

**Architecture:** Keep the existing Node control plane and Go launcher. Add replaceable JSONL-RPC native helpers for PTY and credential access, WebSocket transport for terminal streaming, hash-safe file APIs for Monaco, and a signed staged updater. All repository writes and agent side effects remain governed by ForgeOS.

**Tech Stack:** Node.js 22 ESM, Node test runner, SQLite, Go 1.24, Windows ConPTY, POSIX PTY, xterm.js, Monaco Editor ESM, WebSocket, Ed25519, SHA-256.

## Global Constraints

- Bind network services to loopback only by default.
- Never expose secret plaintext to the browser, logs, SSE, or persisted events.
- Never execute terminal or file operations through `shell: true`.
- Every repository write requires an expected content hash and a Tool Broker receipt.
- Heavy UI modules must load only when the Workroom is opened.
- The release must not contain an update signing private key.
- Existing Forge Studio and ForgeOS test suites remain green.
- Windows x64 is the release target; Linux is the integration-test host.

---

### Task 1: Dependency and asset pipeline

**Files:**
- Modify: `package.json`
- Create: `scripts/build-ui-assets.mjs`
- Modify: `scripts/build-portable.mjs`
- Test: `tests/packaging.test.mjs`

**Interfaces:**
- Produces: local `ui/vendor/xterm/`, `ui/vendor/monaco/`, and `ui/vendor/workroom/` assets copied into portable builds.

- [ ] Add pinned runtime dependencies for `ws`, `@xterm/xterm`, `@xterm/addon-fit`, and `monaco-editor`.
- [ ] Add a failing packaging test that requires generated xterm and Monaco assets and excludes source maps.
- [ ] Run `node --test tests/packaging.test.mjs` and confirm the new assertion fails.
- [ ] Implement `build-ui-assets.mjs` to copy only production assets and Monaco workers.
- [ ] Update `build-portable.mjs` to stage runtime dependencies and generated UI assets.
- [ ] Run the packaging test and commit.

### Task 2: Native PTY host and Node client

**Files:**
- Create: `native/pty/go.mod`
- Create: `native/pty/main.go`
- Create: `native/pty/pty_unix.go`
- Create: `native/pty/pty_windows.go`
- Create: `src/terminal/pty-host-client.mjs`
- Create: `src/terminal/terminal-service.mjs`
- Create: `tests/fixtures/fake-pty-host.mjs`
- Create: `tests/terminal-service.test.mjs`

**Interfaces:**
- Produces: `PtyHostClient.request(method, params)`, notifications, and `TerminalService.create/input/resize/snapshot/terminate/list`.

- [ ] Write a failing Node test for initialize, create, output replay, resize, and terminate using the fixture host.
- [ ] Verify the test fails because the modules do not exist.
- [ ] Implement bounded JSONL-RPC client framing, request timeout, cancellation, and process cleanup.
- [ ] Implement `TerminalService` with workspace and shell allowlist checks.
- [ ] Implement the Go helper with POSIX PTY and Windows ConPTY backends.
- [ ] Run Node tests and `go test ./...` under `native/pty`.
- [ ] Commit.

### Task 3: WebSocket terminal transport and xterm UI

**Files:**
- Modify: `src/server/http-server.mjs`
- Create: `src/server/terminal-websocket.mjs`
- Modify: `src/server/routes.mjs`
- Modify: `ui/index.html`
- Modify: `ui/style.css`
- Modify: `ui/app.js`
- Create: `ui/workroom.js`
- Test: `tests/http-ui.test.mjs`

**Interfaces:**
- Produces: authenticated `/terminal` WebSocket protocol and real Workroom terminal tabs.

- [ ] Add failing HTTP/UI tests for authenticated WebSocket upgrade and real terminal controls.
- [ ] Verify the tests fail.
- [ ] Implement bearer-token WebSocket authentication, frame limits, output coalescing, and cleanup.
- [ ] Implement lazy xterm loading, fit/resizing, reconnect snapshot, terminal create/close controls, and hidden-tab rendering suspension.
- [ ] Run targeted and full tests.
- [ ] Commit.

### Task 4: Hash-safe project file service

**Files:**
- Create: `src/workroom/file-service.mjs`
- Modify: `src/server/routes.mjs`
- Create: `tests/file-service.test.mjs`
- Modify: `tests/http-ui.test.mjs`

**Interfaces:**
- Produces: `FileService.tree/read/write/diff` and `/api/files/*` endpoints.

- [ ] Write failing tests for lazy tree listing, binary/size rejection, hash-safe save, conflict, and diff.
- [ ] Verify red failures.
- [ ] Implement project-scoped path validation and Tool Broker writes.
- [ ] Add authenticated endpoints with bounded request bodies.
- [ ] Run tests and commit.

### Task 5: Monaco workroom

**Files:**
- Create: `ui/editor.js`
- Modify: `ui/workroom.js`
- Modify: `ui/index.html`
- Modify: `ui/style.css`
- Modify: `tests/http-ui.test.mjs`
- Modify: `tests/performance.test.mjs`

**Interfaces:**
- Produces: lazy Monaco editor/diff editor with tabs, view-state restoration, dirty tracking, and conflict-safe save.

- [ ] Add failing UI contract tests for file tree, tabs, save, diff, conflict, and lazy Monaco boot.
- [ ] Verify failure.
- [ ] Implement editor model registry with LRU disposal.
- [ ] Implement file opening, language detection, save shortcut, disk conflict dialog, and diff view.
- [ ] Add a startup test proving Monaco assets are not loaded on dashboard startup.
- [ ] Run tests and commit.

### Task 6: OS credential vault

**Files:**
- Create: `native/credential/go.mod`
- Create: `native/credential/main.go`
- Create: `src/security/credential-helper-client.mjs`
- Create: `src/security/credential-vault.mjs`
- Modify: `src/providers/openai-compatible.mjs`
- Modify: `src/providers/provider-registry.mjs`
- Modify: `src/server/routes.mjs`
- Modify: `ui/index.html`
- Modify: `ui/app.js`
- Create: `tests/credential-vault.test.mjs`

**Interfaces:**
- Produces: credential alias CRUD, server-only resolution, and provider `secretRef` support.

- [ ] Write failing tests ensuring list metadata contains no secret and provider public views cannot leak resolved values.
- [ ] Verify failure.
- [ ] Implement native helper protocol and Windows Credential Manager backend.
- [ ] Implement memory backend for tests and fail-closed release behavior.
- [ ] Integrate request-local secret redaction into provider calls.
- [ ] Add UI and API endpoints that never return plaintext.
- [ ] Run tests and commit.

### Task 7: Signed update engine

**Files:**
- Create: `src/update/canonical-json.mjs`
- Create: `src/update/update-service.mjs`
- Create: `scripts/sign-update-manifest.mjs`
- Modify: `launcher/main.go`
- Create: `launcher/update.go`
- Modify: `src/server/routes.mjs`
- Modify: `ui/index.html`
- Modify: `ui/app.js`
- Create: `tests/update-service.test.mjs`
- Create: `launcher/update_test.go`

**Interfaces:**
- Produces: signed-manifest check/download/stage API and launcher pending-update apply/rollback.

- [ ] Write failing tests for canonical signing, invalid signatures, downgrade rejection, hash mismatch, ZIP traversal, and private-key exclusion.
- [ ] Verify failures.
- [ ] Implement Ed25519 verification and bounded download/staging in Node.
- [ ] Implement launcher atomic swap, health check, and rollback.
- [ ] Add manual update UI and bounded background checks.
- [ ] Run Node and Go tests and commit.

### Task 8: Instruction discovery and workflow templates

**Files:**
- Create: `src/repository/instruction-discovery.mjs`
- Modify: `src/agent/context-builder.mjs`
- Modify: `src/agent/agent-loop.mjs`
- Modify: `src/server/routes.mjs`
- Create: `tests/instruction-discovery.test.mjs`
- Modify: `tests/context-intelligence.test.mjs`

**Interfaces:**
- Produces: normalized instruction records with provenance, glob scope, trust label, and workflow templates.

- [ ] Write failing tests for AGENTS, CLAUDE, FORGE, Cursor, and Windsurf discovery and task-scoped selection.
- [ ] Verify failure.
- [ ] Implement bounded parsing without executing embedded instructions.
- [ ] Inject matching records into ContextPack as untrusted project guidance.
- [ ] Expose operator-invoked workflow templates.
- [ ] Run tests and commit.

### Task 9: Resource governor and recovery state

**Files:**
- Create: `src/runtime/resource-governor.mjs`
- Modify: `src/config.mjs`
- Modify: `src/storage/studio-store.mjs`
- Modify: `src/terminal/terminal-service.mjs`
- Modify: `src/app.mjs`
- Create: `tests/resource-governor.test.mjs`
- Modify: `tests/performance.test.mjs`

**Interfaces:**
- Produces: normal/pressure/brownout states, concurrency admission, terminal backpressure, and persisted workroom layout.

- [ ] Write failing deterministic tests for thresholds, hysteresis, admission, and transition-only events.
- [ ] Verify failure.
- [ ] Implement the governor and wire terminal/agent limits.
- [ ] Persist and restore editor tabs, terminal definitions, and layout metadata.
- [ ] Run tests and commit.

### Task 10: Composition, release, and verification

**Files:**
- Modify: `src/app.mjs`
- Modify: `scripts/build-windows.sh`
- Modify: `scripts/build-portable.mjs`
- Modify: `scripts/smoke.mjs`
- Modify: `README.md`
- Modify: `docs/ARCHITECTURE.md`
- Create: `docs/RELEASE-0.3.0.md`
- Modify: `project-manifest.json`
- Modify: `tests/packaging.test.mjs`

**Interfaces:**
- Produces: Forge Studio 0.3 source ZIP, Windows x64 package, native helpers, manifests, checksums, and verification report.

- [ ] Wire all services through the composition root without global secret state.
- [ ] Build native Windows launcher, PTY helper, and credential helper.
- [ ] Build local UI assets and portable package.
- [ ] Run all Forge Studio tests.
- [ ] Run all vendored ForgeOS tests.
- [ ] Run staged-package smoke tests including file conflict, PTY, vault metadata, and invalid update rejection.
- [ ] Verify ZIP integrity, PE format, manifests, and SHA-256 files.
- [ ] Commit release sources and export artifacts.
