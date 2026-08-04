# Forge Studio 1.0 Adaptive Agent Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure semantic code intelligence, dynamic context/tool loading, outcome-aware routing, evidence-backed memory, independent review, local automation, design context, and reproducible source releases.

**Architecture:** Focused ESM services communicate through typed immutable records and the existing StudioStore, capability registry, event ledger, tool gateway, and HTTP composition. All new behavior is local-first, deterministic where possible, and emits receipts.

**Tech Stack:** Node.js 22 ESM, built-in SQLite, SHA-256/Merkle hashing, existing ForgeOS canonical JSON/receipts, existing HTTP/tool gateway, Node test runner.

## Global Constraints

- No external runtime dependency is required for the offline baseline.
- No secret or denied file content enters an index, prompt, log, or receipt.
- No model/provider is trusted to self-report success.
- Full release matrix must run after every release candidate change.
- Cloud-only features stay behind drivers and are not labeled production-complete.
- Source archives must be independently reconstructible.

---

### Task 1: Restore and lock ForgeOS source dependency

**Files:**
- Create: `vendor/forge-os/**`
- Create: `vendor/forge-os.manifest.json`
- Modify: `scripts/build-source-release.mjs`
- Modify: `src/release/full-release-matrix.mjs`
- Test: `tests/source-reconstruction.test.mjs`

**Interfaces:**
- Produces: `verifyForgeOsVendor(root): Promise<VerificationResult>` and a source-reconstruction matrix gate.

- [ ] Write a failing test that extracts a source archive and imports ForgeOS canonical JSON and orchestrator modules.
- [ ] Run the test and confirm failure because the source archive omits `vendor/forge-os`.
- [ ] Restore ForgeOS from the user-supplied 0.6.1 source, generate a path/size/SHA-256 manifest, and include it in source packaging.
- [ ] Add a release gate that extracts the archive into a blank directory and runs representative Node and VS Code build checks.
- [ ] Run the focused test and baseline suite.

### Task 2: Secure semantic and Merkle index

**Files:**
- Create: `src/repository/syntax-chunker.mjs`
- Create: `src/repository/merkle-index.mjs`
- Create: `src/repository/embedding-provider.mjs`
- Create: `src/repository/secure-semantic-index.mjs`
- Modify: `src/repository/repository-index.mjs`
- Test: `tests/secure-semantic-index.test.mjs`

**Interfaces:**
- Produces: `SecureSemanticIndex.index(project, options)`, `search(projectId, query, options)`, `exportSnapshot(projectId)`, and `reuseSnapshot(project, snapshot, proofs)`.

- [ ] Write failing tests for syntax chunks, incremental reuse, hybrid ranking, Merkle roots, content proofs, and query-before-embedding-complete behavior.
- [ ] Implement deterministic syntactic chunking and feature-hash embeddings.
- [ ] Implement content-addressed embedding cache and Merkle tree persistence.
- [ ] Implement hybrid lexical/semantic/graph scoring with explainable score components.
- [ ] Implement secure snapshot export/reuse that filters results without matching local proofs.
- [ ] Run focused and repository-index tests.

### Task 3: Dynamic context and tool catalog

**Files:**
- Create: `src/agent/dynamic-context-store.mjs`
- Create: `src/agent/dynamic-tool-catalog.mjs`
- Create: `src/agent/context-planner-v2.mjs`
- Modify: `src/agent/context-builder.mjs`
- Modify: `src/execution/tool-broker.mjs`
- Test: `tests/dynamic-context-discovery.test.mjs`

**Interfaces:**
- Produces: `artifactize(result, scope)`, `preview(artifactId)`, `searchArtifact(artifactId, query)`, `toolSummary()`, `loadSchema(toolName)`, and `planContext(request)`.

- [ ] Write failing tests for long-output artifactization, redaction, paging/search, transcript recovery, compact tool summaries, schema-on-demand, and role-specific context budgets.
- [ ] Implement immutable artifact files with hashes and bounded previews.
- [ ] Implement transcript and terminal-history storage using the same record format.
- [ ] Implement progressive tool schema loading and pinned core tools.
- [ ] Integrate bounded artifact results into tool-broker normalization.
- [ ] Run focused and tool-broker tests.

### Task 4: Adaptive router v2

**Files:**
- Create: `src/providers/task-classifier.mjs`
- Create: `src/providers/router-feedback-store.mjs`
- Modify: `src/providers/adaptive-router.mjs`
- Test: `tests/adaptive-router-v2.test.mjs`

**Interfaces:**
- Produces: `classifyTask(input)`, `rankV2(options)`, `recordOutcome(outcome)`, and explainable routing decisions.

- [ ] Write failing tests for task classification, intelligence/balanced/cost policies, prompt-cache affinity, code-retention feedback, capability fit, and deterministic explanations.
- [ ] Implement classifier and persisted feedback aggregates.
- [ ] Extend ranking without breaking explicit overrides or circuit-breaker behavior.
- [ ] Run focused and provider tests.

### Task 5: Memory sidecar and revalidation

**Files:**
- Create: `src/memory/memory-sidecar.mjs`
- Modify: `src/memory/memory-service.mjs`
- Test: `tests/memory-sidecar.test.mjs`

**Interfaces:**
- Produces: `proposeFromTask(taskEvidence)`, `approveCandidate(id, actor)`, `revalidate(projectId)`, and citation-bearing memory context.

- [ ] Write failing tests for proposal-only behavior, citations, approval, TTL, content-hash revalidation, stale transitions, and project isolation.
- [ ] Implement deterministic candidate extraction from verified receipts and changed files.
- [ ] Add expiry and evidence metadata to memory records without auto-activating candidates.
- [ ] Run focused and existing memory tests.

### Task 6: Independent incremental reviewer

**Files:**
- Create: `src/review/independent-review-service.mjs`
- Create: `src/review/review-fingerprint.mjs`
- Create: `src/review/static-review-rules.mjs`
- Test: `tests/independent-review.test.mjs`

**Interfaces:**
- Produces: `review(changeSet, context)`, `reviewIncremental(previousReviewId, changeSet, context)`, and stable finding records.

- [ ] Write failing tests for executor-context isolation, diff fingerprint dedupe, incremental findings, stable IDs, security rules, unresolved finding carry-forward, and signed receipts.
- [ ] Implement canonical diff fingerprints and static high-confidence checks.
- [ ] Integrate repository retrieval, project rules, diagnostics, and test evidence as reviewer inputs.
- [ ] Run focused and review-summary tests.

### Task 7: Durable local automations

**Files:**
- Create: `src/automations/local-automation-service.mjs`
- Create: `src/automations/automation-store.mjs`
- Create: `src/automations/automation-trigger.mjs`
- Test: `tests/local-automations.test.mjs`

**Interfaces:**
- Produces: `createAutomation(spec)`, `claimDue(workerId)`, `completeRun(runId, result)`, `submitEvent(event)`, and `listRuns(automationId)`.

- [ ] Write failing tests for durable schedules, event filters, fencing leases, retries, restart recovery, review-only output policy, and capability-gated push/deploy.
- [ ] Implement SQLite persistence and deterministic trigger evaluation.
- [ ] Create task contracts and isolated worktree requests rather than executing arbitrary commands directly.
- [ ] Run focused tests.

### Task 8: Design context service

**Files:**
- Create: `src/browser/design-context-service.mjs`
- Modify: `src/browser/playwright-cli-driver.mjs`
- Test: `tests/design-context.test.mjs`

**Interfaces:**
- Produces: `captureSelection(pageSession, selectors, options)` with screenshot hash, DOM/accessibility/style summaries, bounding boxes, and source hints.

- [ ] Write failing tests for single/multi-select, spatial annotations, bounded DOM/style output, screenshot evidence, and read-only enforcement.
- [ ] Implement browser-driver script generation and normalized design context records.
- [ ] Run focused browser and visual tests.

### Task 9: Application/tool/API integration

**Files:**
- Modify: `src/app.mjs`
- Modify: `src/agent/operating-plane-service.mjs`
- Modify: `src/agent/operating-plane-tool-gateway.mjs`
- Modify: `src/server/http-server.mjs`
- Test: `tests/adaptive-intelligence-wiring.test.mjs`

**Interfaces:**
- Consumes all services from Tasks 2-8.
- Produces governed model tools and authenticated read/write APIs.

- [ ] Write failing wiring tests for service composition, schemas, permissions, receipts, and secret-safe public views.
- [ ] Register semantic search, context artifact, memory proposal, independent review, automation, and design-context tools with least privilege.
- [ ] Add authenticated API routes and tenant/project checks.
- [ ] Run focused API/model wiring tests.

### Task 10: Audit, documentation, and full release

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Create: `docs/RELEASE-1.0.0.md`
- Create: `docs/VERIFICATION-REPORT-1.0.0.md`
- Create: `docs/LIMITATIONS-1.0.0.md`
- Modify: `scripts/audit-feature-checklist.mjs`
- Modify: `project-manifest.json`

**Interfaces:**
- Produces: versioned source/desktop/VSIX artifacts, release manifest, checksums, audit JSON/Markdown, and full matrix receipts.

- [ ] Update only checklist items supported by direct source/test evidence.
- [ ] Run all focused tests, then the complete Node suite.
- [ ] Run `npm run release:matrix`; on any failure fix the root cause and rerun every gate from the beginning.
- [ ] Independently extract and inspect every archive and verify SHA-256 values.
- [ ] Publish only artifacts created or changed in this response and update project manifest statuses.
