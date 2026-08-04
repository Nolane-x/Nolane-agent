# Forge Studio 0.9.0 Agent Operating Plane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reproducible, governed operating plane with hooks, scoped subagents, rewindable sessions, LSP intelligence, typed Git, CLI/SDK clients, secret scanning, and visual comparison.

**Architecture:** New capabilities are narrow services behind existing Forge policy and receipt boundaries. Desktop, IDE, CLI, SDK, and cloud adapters consume the same schemas; no client receives raw execution authority.

**Tech Stack:** Node.js 22 ESM, built-in `node:test`, built-in SQLite, child-process argv execution, JSON-RPC/LSP, TypeScript 5.8, Python 3 standard library, Git, optional Sharp image backend.

## Global Constraints

- No production code before a failing behavior test.
- No shell interpolation for hooks, LSP, Git, CLI helpers, or provider adapters.
- Deny rules override allow rules.
- Secrets remain server-side and are redacted from logs, events, receipts, and errors.
- External infrastructure gates remain explicitly external.
- Every state mutation records a content-addressed receipt or append-only event.
- Windows, Linux, and macOS path and process behavior must be represented in contracts and native CI matrices.

---

### Task 1: Reproducible VS Code source build

**Files:**
- Create: `extensions/vscode/src/client.ts`
- Create: `extensions/vscode/src/extension.ts`
- Create: `extensions/vscode/src/vscode.d.ts`
- Create: `extensions/vscode/tsconfig.json`
- Create: `scripts/build-vscode-extension.mjs`
- Modify: `.gitignore`
- Modify: `package.json`
- Modify: `tests/release-tooling.test.mjs`

**Interfaces:**
- Produces `buildVsCodeExtension({ rootDir, outputFile? })` and tracked TypeScript source that compiles to `extensions/vscode/extension/dist/*.js`.

- [ ] Add a test that removes `dist`, runs the source build, validates both JavaScript files, and packages a valid VSIX.
- [ ] Run `node --test tests/release-tooling.test.mjs` and verify failure because the build function/source does not exist.
- [ ] Implement the TypeScript source, declarations, compiler config, build script, and package command.
- [ ] Re-run the focused test and verify pass.
- [ ] Commit with `fix: make vscode extension reproducible`.

### Task 2: Lifecycle hook engine

**Files:**
- Create: `src/hooks/hook-schema.mjs`
- Create: `src/hooks/hook-config-loader.mjs`
- Create: `src/hooks/hook-engine.mjs`
- Create: `tests/hook-engine.test.mjs`

**Interfaces:**
- Produces `HookEngine.run(eventName, payload, context)` returning `{ decision, payload, additionalContext, allowedTools, retry, audit }`.

- [ ] Add tests for deny, safe argument rewrite, context injection, timeout, output limit, project containment, and deny-overrides-allow.
- [ ] Run `node --test tests/hook-engine.test.mjs` and verify module-not-found failure.
- [ ] Implement strict schemas, layered loading, argv-only execution, JSON stdin/stdout, limits, and audit digests.
- [ ] Re-run the focused test and verify pass.
- [ ] Commit with `feat: add governed lifecycle hooks`.

### Task 3: Agent profiles and subagent orchestration

**Files:**
- Create: `src/agents/agent-profile-loader.mjs`
- Create: `src/agents/subagent-orchestrator.mjs`
- Create: `src/agents/agent-tool-gateway.mjs`
- Create: `tests/subagent-orchestrator.test.mjs`

**Interfaces:**
- Produces `AgentProfileLoader.loadProjectProfiles(projectRoot)` and `SubagentOrchestrator.run({ parentTask, profileId, objective, dependencies })`.

- [ ] Add tests for frontmatter validation, capability intersection, exclusive-tool isolation, concurrency, cancellation, dependency ordering, and signed handoff events.
- [ ] Run the focused test and verify missing-module failure.
- [ ] Implement profile loading, permission intersection, isolated child context, event streaming, concurrency leases, and handoff receipts.
- [ ] Re-run the focused test and verify pass.
- [ ] Commit with `feat: add scoped subagent orchestration`.

### Task 4: Durable session ledger, checkpoint, rewind, and fork

**Files:**
- Create: `src/sessions/session-ledger.mjs`
- Create: `src/sessions/session-replay.mjs`
- Create: `tests/session-ledger.test.mjs`

**Interfaces:**
- Produces `SessionLedger.append`, `checkpoint`, `rewind`, `fork`, `verify`, and `SessionReplay.materialize`.

- [ ] Add tests for hash-chain verification, corruption detection, checkpoint binding, rewind without deletion, fork lineage, and deterministic replay.
- [ ] Run the focused test and verify missing-module failure.
- [ ] Implement append-only JSONL persistence with canonical hashes and branch cursors.
- [ ] Re-run the focused test and verify pass.
- [ ] Commit with `feat: add rewindable session ledger`.

### Task 5: LSP intelligence gateway

**Files:**
- Create: `src/repository/lsp-client.mjs`
- Create: `src/repository/language-server-registry.mjs`
- Create: `src/repository/code-intelligence-service.mjs`
- Create: `tests/fixtures/fake-lsp-server.mjs`
- Create: `tests/lsp-intelligence.test.mjs`

**Interfaces:**
- Produces `LspClient`, `LanguageServerRegistry`, and `CodeIntelligenceService` methods for symbols, definition, references, diagnostics, and call hierarchy.

- [ ] Add tests for Content-Length framing, initialize/shutdown, timeout/cancellation, bounded results, document sync, and fallback to repository index.
- [ ] Run the focused test and verify missing-module failure.
- [ ] Implement the generic stdio client and normalized intelligence service.
- [ ] Re-run the focused test and verify pass.
- [ ] Commit with `feat: add language server intelligence`.

### Task 6: Typed Git gateway and secret scanner

**Files:**
- Create: `src/security/secret-scanner.mjs`
- Create: `src/repository/git-gateway.mjs`
- Create: `src/repository/pull-request-providers.mjs`
- Create: `tests/git-gateway.test.mjs`

**Interfaces:**
- Produces `SecretScanner.scanText`, `GitGateway` typed mutations, and `PullRequestProviders.buildRequest`/`createPullRequest`.

- [ ] Add tests for dirty-tree protection, expected-HEAD binding, stage/commit secret blocking, merge/rebase/cherry-pick/revert/reset, conflict inspection/abort, and GitHub/GitLab/Bitbucket request construction.
- [ ] Run the focused test and verify missing-module failure.
- [ ] Implement argv-only Git execution, mutation policies, receipts, and server-side provider requests.
- [ ] Re-run the focused test and verify pass.
- [ ] Commit with `feat: add typed git delivery gateway`.

### Task 7: CLI and SDKs

**Files:**
- Create: `cli/forge-studio.mjs`
- Create: `src/client/forge-studio-client.mjs`
- Create: `sdk/typescript/index.mjs`
- Create: `sdk/typescript/index.d.ts`
- Create: `sdk/typescript/package.json`
- Create: `sdk/python/forge_studio/__init__.py`
- Create: `sdk/python/forge_studio/client.py`
- Create: `sdk/python/pyproject.toml`
- Create: `tests/client-cli-sdk.test.mjs`
- Create: `sdk/python/tests/test_client.py`

**Interfaces:**
- Produces one protocol client shared by CLI and TypeScript SDK plus a compatible Python client.

- [ ] Add tests for secure endpoint policy, auth headers, timeout, errors, JSON output, interactive commands, pagination, and Python compatibility.
- [ ] Run Node and Python focused tests and verify missing-module failures.
- [ ] Implement the shared client, CLI command parser, TypeScript declarations, and Python standard-library client.
- [ ] Re-run focused tests and verify pass.
- [ ] Commit with `feat: add cli and public sdks`.

### Task 8: Visual comparison and application wiring

**Files:**
- Create: `src/browser/image-comparison-service.mjs`
- Create: `tests/image-comparison.test.mjs`
- Modify: `src/app.mjs`
- Modify: `src/agent/agent-loop.mjs`
- Modify: `src/server/routes.mjs`
- Modify: `src/version.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces governed schemas and routes for hooks, profiles, sessions, code intelligence, Git, SDK/CLI diagnostics, and image comparison.

- [ ] Add tests for image hashes, changed-pixel ratio, diff artifact, invalid formats, oversized images, missing backend, and full app wiring.
- [ ] Run focused tests and verify failure.
- [ ] Implement optional Sharp-backed comparison and wire all new services through policy, receipts, routes, and model schemas.
- [ ] Re-run focused tests and verify pass.
- [ ] Commit with `feat: wire agent operating plane`.

### Task 9: Audit, documentation, and release

**Files:**
- Modify: `docs/source-feature-checklist-vn.txt` only if normalization is required, never to remove requirements.
- Create: `docs/RELEASE-0.9.0.md`
- Create: `docs/VERIFICATION-REPORT-0.9.0.md`
- Create: `docs/LIMITATIONS-0.9.0.md`
- Create: `docs/FEATURE-COMPLETENESS-AUDIT-0.9.0.md`
- Create: `docs/feature-audit-0.9.0.json`
- Modify: `project-manifest.json`
- Create: `release/release-manifest-0.9.0.json`
- Create: `release/SHA256SUMS-0.9.0.txt`

**Interfaces:**
- Produces source ZIP, Windows bootstrap, VSIX, SDK archives, CLI archive, audit, manifests, and checksums.

- [ ] Run the full Node suite, Go suites, VS Code build, Python SDK tests, source smoke, self-benchmark, and feature audit.
- [ ] Fix any failure at its root and repeat the complete gate.
- [ ] Generate 0.9.0 artifacts from the verified commit and validate archive contents and SHA-256.
- [ ] Record exact evidence and all remaining external gates without claiming independent benchmark superiority.
- [ ] Commit with `release: package Forge Studio 0.9.0`.
