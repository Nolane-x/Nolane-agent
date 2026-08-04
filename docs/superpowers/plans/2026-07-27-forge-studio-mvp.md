# Forge Studio Core MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real, portable Forge Studio Core that can plan and run bounded AI coding tasks through ForgeOS, official coding CLIs, an OpenAI-compatible API, a safe tool broker, durable task/evidence storage, clean-room web intelligence, and a lightweight desktop-style local UI.

**Architecture:** A dependency-light Node.js 22 control plane owns durable state, policy, task DAGs, provider adapters, tool execution, evidence, and the local web UI. ForgeOS 0.6.1 is vendored and imported as the authority for routing, bounded context, approvals, security, and receipts. A tiny Go launcher starts the bundled Node runtime and opens Edge/Chrome in app mode; this creates a Windows portable build without Electron or Tauri.

**Tech Stack:** Node.js 22 ESM, built-in `node:sqlite`, built-in `fetch`, Node test runner, vendored ForgeOS 0.6.1, static HTML/CSS/JavaScript, Go 1.23 launcher, PowerShell packaging scripts.

## Global Constraints

- The application must run without npm runtime dependencies.
- The Windows portable distribution must include a Node 22 runtime and a native `ForgeStudio.exe` launcher.
- Every model loop must have hard limits for turns, tool calls, elapsed time, and estimated tokens.
- Every side-effecting tool must execute through the Forge tool broker with path containment, command allowlists, bounded output, and receipts.
- ForgeOS remains the authority for skill routing and context materialization.
- Official Codex, Claude, Gemini, OpenCode, and NolaneNative credentials remain owned by their CLIs; Forge Studio never extracts their tokens.
- Wigolo AGPL source must not be copied; web intelligence is a clean-room implementation.
- The UI must have no fake controls: every enabled control calls a real endpoint.
- Default operation must remain usable on an 8 GB Windows machine.

---

## File Map

- `package.json`: root scripts, executable metadata, and Node version floor.
- `src/app.mjs`: composition root and process lifecycle.
- `src/config.mjs`: validated local configuration and defaults.
- `src/protocol/events.mjs`: stable event envelope and SSE serialization.
- `src/storage/studio-store.mjs`: SQLite schema and durable repositories.
- `src/security/redaction.mjs`: secret and untrusted-content redaction.
- `src/security/path-policy.mjs`: workspace containment and symlink checks.
- `src/execution/tool-broker.mjs`: governed file/process tools and receipts.
- `src/execution/worktree-manager.mjs`: isolated Git worktrees.
- `src/forge/forgeos-bridge.mjs`: ForgeOS project, routing, context, and evidence integration.
- `src/providers/provider-registry.mjs`: provider registration, detection, and safe configuration views.
- `src/providers/openai-compatible.mjs`: direct API model adapter with tool-call normalization.
- `src/providers/cli-provider.mjs`: official CLI bridges with safe defaults and custom templates.
- `src/agent/budget.mjs`: hard iteration/tool/time/token budgets adapted from NolaneNative’ bounded-loop concept.
- `src/agent/message-sanitization.mjs`: provider-safe message and tool JSON repair.
- `src/agent/context-builder.mjs`: layered prompt/context assembly with omission records.
- `src/agent/agent-loop.mjs`: bounded model/tool loop and checkpointing.
- `src/orchestration/task-graph.mjs`: dependency DAG, lease, and fencing rules.
- `src/orchestration/mission-runner.mjs`: task execution and evidence-gated completion.
- `src/web/cache.mjs`: HTTP cache with ETag, freshness, and content hashes.
- `src/web/extract.mjs`: clean-room HTML-to-text/Markdown extraction.
- `src/web/intelligence.mjs`: search, fetch, source ranking, and research evidence packets.
- `src/server/http-server.mjs`: local authenticated REST/SSE server.
- `src/server/routes.mjs`: endpoint dispatch and request validation.
- `ui/index.html`, `ui/app.js`, `ui/style.css`: dependency-free desktop-style UI.
- `launcher/main.go`: cross-platform native launcher.
- `scripts/build-portable.mjs`: source staging and portable directory build.
- `scripts/build-windows.sh`: Node runtime download/extraction and Windows launcher compilation.
- `scripts/smoke.mjs`: packaged-runtime smoke test.
- `tests/*.test.mjs`: unit and integration tests.
- `docs/ARCHITECTURE.md`: architecture and trust boundaries.
- `docs/USER-GUIDE.md`: setup, providers, and workflows.
- `project-manifest.json`: artifact and source inventory.

---

### Task 1: Protocol, configuration, and durable store

**Files:**
- Create: `package.json`
- Create: `src/config.mjs`
- Create: `src/protocol/events.mjs`
- Create: `src/storage/studio-store.mjs`
- Test: `tests/config-store.test.mjs`

**Interfaces:**
- Produces: `loadConfig(overrides): StudioConfig`, `createEvent(type, payload, refs): ForgeEvent`, `StudioStore` with project, mission, task, run, event, approval, provider, and evidence methods.

- [ ] **Step 1: Write failing tests** for safe defaults, workspace normalization, immutable event envelopes, SQLite migrations, task persistence, and append-only events.
- [ ] **Step 2: Run** `node --test tests/config-store.test.mjs` and confirm missing-module failures.
- [ ] **Step 3: Implement minimal modules** using only built-in Node APIs and `node:sqlite`.
- [ ] **Step 4: Re-run** the focused test, then `npm test`.
- [ ] **Step 5: Commit** `feat(core): add protocol configuration and durable store`.

### Task 2: Security primitives and governed tool broker

**Files:**
- Create: `src/security/redaction.mjs`
- Create: `src/security/path-policy.mjs`
- Create: `src/execution/tool-broker.mjs`
- Test: `tests/tool-broker.test.mjs`

**Interfaces:**
- Produces: `redactSecrets(value)`, `WorkspacePolicy`, `ToolBroker.execute(request, context)` and content-addressed `ToolReceipt`.

- [ ] **Step 1: Write failing tests** for traversal, symlink escape, unallowlisted commands, environment filtering, output truncation, timeouts, secret redaction, atomic writes, and receipt hashes.
- [ ] **Step 2: Run** the focused test and verify expected failures.
- [ ] **Step 3: Implement** read, list, search, patch/write, and process tools; never use `shell: true`.
- [ ] **Step 4: Run** focused and full tests.
- [ ] **Step 5: Commit** `feat(security): add governed tool broker`.

### Task 3: ForgeOS authority bridge

**Files:**
- Create: `src/forge/forgeos-bridge.mjs`
- Test: `tests/forgeos-bridge.test.mjs`

**Interfaces:**
- Consumes: vendored `SkillIntelligenceService`, `ForgeOrchestrator`, `ProjectStore`, and `BrokeredProcessRunner`.
- Produces: `ForgeOsBridge.createProject`, `route`, `buildContextPack`, `requestApproval`, `recordEvidence`, and `snapshot`.

- [ ] **Step 1: Write failing tests** proving route determinism, bounded skill materialization, project creation, omission reporting, and evidence recording.
- [ ] **Step 2: Run** the focused test.
- [ ] **Step 3: Implement** the bridge without modifying Trust Kernel behavior.
- [ ] **Step 4: Run** focused tests plus the vendored ForgeOS test suite.
- [ ] **Step 5: Commit** `feat(forgeos): add studio authority bridge`.

### Task 4: Provider registry and official CLI bridges

**Files:**
- Create: `src/providers/provider-registry.mjs`
- Create: `src/providers/cli-provider.mjs`
- Test: `tests/provider-registry.test.mjs`

**Interfaces:**
- Produces: `ProviderRegistry.detectAll()`, `ProviderRegistry.publicView()`, and `CliProvider.invoke(request)`.

- [ ] **Step 1: Write failing tests** with temporary fake executables for Codex, Claude, Gemini, OpenCode, and NolaneNative detection, version parsing, timeout, cancellation, and secret-free public views.
- [ ] **Step 2: Run** the focused test.
- [ ] **Step 3: Implement** CLI templates with argv arrays and user-overridable executable/args.
- [ ] **Step 4: Run** focused and full tests.
- [ ] **Step 5: Commit** `feat(providers): add safe coding CLI bridges`.

### Task 5: OpenAI-compatible provider and NolaneNative-derived safeguards

**Files:**
- Create: `src/providers/openai-compatible.mjs`
- Create: `src/agent/budget.mjs`
- Create: `src/agent/message-sanitization.mjs`
- Test: `tests/model-provider.test.mjs`

**Interfaces:**
- Produces: `OpenAICompatibleProvider.complete(request)`, `RunBudget`, `sanitizeMessages`, and `repairToolArguments`.

- [ ] **Step 1: Write failing tests** against a local fake HTTP model server for normal text, tool calls, malformed JSON repair, surrogate sanitization, timeout, HTTP errors, and hard budgets.
- [ ] **Step 2: Run** the focused test.
- [ ] **Step 3: Implement** a minimal Chat Completions adapter and bounded counters.
- [ ] **Step 4: Run** focused and full tests.
- [ ] **Step 5: Commit** `feat(agent): add bounded API provider core`.

### Task 6: Context builder and bounded agent loop

**Files:**
- Create: `src/agent/context-builder.mjs`
- Create: `src/agent/agent-loop.mjs`
- Test: `tests/agent-loop.test.mjs`

**Interfaces:**
- Consumes: `ForgeOsBridge`, `ProviderRegistry`, `ToolBroker`, `StudioStore`, `RunBudget`.
- Produces: `AgentLoop.run(task, options): AgentRunResult`.

- [ ] **Step 1: Write failing tests** for route-before-model, tool proposal/receipt flow, checkpoint persistence, cancellation, budget exhaustion, model retry classification, no-tool completion, and refusal to self-certify evidence.
- [ ] **Step 2: Run** the focused test.
- [ ] **Step 3: Implement** layered context, event emission, tool result artifacts, and completion requests.
- [ ] **Step 4: Run** focused and full tests.
- [ ] **Step 5: Commit** `feat(agent): add forge-governed agent loop`.

### Task 7: Task graph, leases, fencing, and worktrees

**Files:**
- Create: `src/orchestration/task-graph.mjs`
- Create: `src/execution/worktree-manager.mjs`
- Test: `tests/task-graph.test.mjs`

**Interfaces:**
- Produces: `TaskGraph.validate`, `TaskScheduler.claim`, `heartbeat`, `complete`, `fail`, and `WorktreeManager.create/remove`.

- [ ] **Step 1: Write failing tests** for cycles, unmet dependencies, parallel independent tasks, expired leases, stale fencing tokens, path ownership conflicts, worktree creation, and cleanup.
- [ ] **Step 2: Run** the focused test.
- [ ] **Step 3: Implement** deterministic DAG ordering and Git worktree isolation.
- [ ] **Step 4: Run** focused and full tests.
- [ ] **Step 5: Commit** `feat(orchestration): add durable task graph and worktrees`.

### Task 8: Clean-room Forge Web Intelligence

**Files:**
- Create: `src/web/cache.mjs`
- Create: `src/web/extract.mjs`
- Create: `src/web/intelligence.mjs`
- Test: `tests/web-intelligence.test.mjs`

**Interfaces:**
- Produces: `WebIntelligence.fetch`, `search`, and `research`, returning source hashes, citations, freshness, extraction warnings, and omission reasons.

- [ ] **Step 1: Write failing tests** with local HTML/search fixtures for robots policy, cache revalidation, canonical URLs, boilerplate stripping, source deduplication, domain diversity, freshness ranking, bounded fetches, and evidence packets.
- [ ] **Step 2: Run** the focused test.
- [ ] **Step 3: Implement** HTTP-first retrieval, clean extraction, provider adapters for Brave/Tavily/custom JSON, and deterministic evidence fallback.
- [ ] **Step 4: Run** focused and full tests.
- [ ] **Step 5: Commit** `feat(web): add clean-room web intelligence`.

### Task 9: Mission runner and evidence-gated completion

**Files:**
- Create: `src/orchestration/mission-runner.mjs`
- Test: `tests/mission-runner.test.mjs`

**Interfaces:**
- Produces: `MissionRunner.plan`, `runNext`, `verify`, `stop`, and `resume`.

- [ ] **Step 1: Write failing tests** for planner JSON validation, role assignment, independent review, failed-test blocking, evidence binding to commit/hash, and emergency stop.
- [ ] **Step 2: Run** the focused test.
- [ ] **Step 3: Implement** coordinator/scout/builder/reviewer task roles over the durable graph.
- [ ] **Step 4: Run** focused and full tests.
- [ ] **Step 5: Commit** `feat(swarm): add evidence-gated mission runner`.

### Task 10: Local API, SSE, and real UI

**Files:**
- Create: `src/server/routes.mjs`
- Create: `src/server/http-server.mjs`
- Create: `src/app.mjs`
- Create: `ui/index.html`
- Create: `ui/app.js`
- Create: `ui/style.css`
- Copy: `vendor/forge-os/assets/forgeos-mark.svg` to `ui/forgeos-mark.svg`
- Test: `tests/http-ui.test.mjs`

**Interfaces:**
- Produces: local bearer-auth REST API, `/events` SSE, health endpoint, and actionable UI.

- [ ] **Step 1: Write failing tests** for loopback binding, auth, CSP, traversal rejection, project/task/provider APIs, SSE replay, agent start/stop, and UI endpoint wiring.
- [ ] **Step 2: Run** the focused test.
- [ ] **Step 3: Implement** the server and dependency-free UI.
- [ ] **Step 4: Run** focused and full tests plus a browser-free API smoke test.
- [ ] **Step 5: Commit** `feat(ui): add lightweight Forge Studio workroom`.

### Task 11: Native launcher and portable Windows package

**Files:**
- Create: `launcher/go.mod`
- Create: `launcher/main.go`
- Create: `scripts/build-portable.mjs`
- Create: `scripts/build-windows.sh`
- Create: `scripts/smoke.mjs`
- Test: `tests/packaging.test.mjs`

**Interfaces:**
- Produces: `release/ForgeStudio-portable/ForgeStudio.exe`, bundled Node runtime, application source, and launch scripts.

- [ ] **Step 1: Write failing packaging tests** for staged files, relative runtime discovery, random loopback port handoff, single-instance lock, and clean shutdown.
- [ ] **Step 2: Run** the focused test.
- [ ] **Step 3: Implement** Go launcher and packaging scripts.
- [ ] **Step 4: Build** Linux launcher and cross-compile Windows `ForgeStudio.exe`; stage official Node Windows runtime.
- [ ] **Step 5: Run** source smoke tests and inspect the PE header/version; commit `build: add portable Windows distribution`.

### Task 12: Documentation, manifests, benchmarks, and release verification

**Files:**
- Create: `README.md`
- Create: `docs/ARCHITECTURE.md`
- Create: `docs/USER-GUIDE.md`
- Create: `docs/SECURITY.md`
- Create: `docs/RESEARCH-NOTES.md`
- Create: `project-manifest.json`
- Create: `tests/performance.test.mjs`

**Interfaces:**
- Produces: reproducible release commands, documented limitations, artifact hashes, and resource measurements.

- [ ] **Step 1: Write failing performance/release tests** for startup, bounded event history, tool output memory, manifest completeness, and no placeholder/fake-control strings.
- [ ] **Step 2: Run** the focused test.
- [ ] **Step 3: Write documentation and manifest generator; remove stale or unsupported claims.
- [ ] **Step 4: Run** `npm test`, vendored ForgeOS tests, `npm run validate`, `npm run smoke`, and the portable build verification.
- [ ] **Step 5: Commit** `docs: complete Forge Studio MVP release dossier`.
