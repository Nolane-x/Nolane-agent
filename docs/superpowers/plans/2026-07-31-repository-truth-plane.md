# Repository Truth Plane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Forge Studio 3.3.0 Repository Truth Plane and promote exactly eleven Repository Digital Twin P0 requirements with reproducible evidence.

**Architecture:** Add a branch-scoped fact ledger, focused map builder, staged evidence planner, and paged viewer around the existing digital-twin service. Integrate lazily through Repository Intelligence Fabric, then add deterministic measurement, audit transitions, documentation, version coherence, and release gate 72.

**Tech Stack:** Node.js ESM, `node:test`, SQLite-backed `StudioStore`, existing repository index/semantic tables, canonical SHA-256 receipts, Git CLI for real integration fixtures.

## Global Constraints

- Preserve all existing `RepositoryDigitalTwinService.build()` v1-compatible fields.
- Every persisted or returned fact must have a citation with a 64-character source SHA-256.
- Cross-branch facts must fail closed when branch/worktree/citation state does not match.
- Editor overlays must never overwrite disk-index facts.
- Query order is exactly `exact, lexical, ast-lsp, graph, git, test, semantic, runtime`.
- External gate count remains exactly `63`.
- Promote only `32.2, 32.3, 32.4, 32.7, 32.9, 32.10, 32.11, 32.12, 32.15, 32.17, 32.18`.
- Target audit summary is exactly `996 verified_source_test, 91 partial, 63 external_gate, 0 not_implemented`.
- No comparative superiority claim.

---

### Task 1: Branch-scoped fact ledger

**Files:**
- Create: `src/repository/repository-fact-ledger.mjs`
- Create: `tests/repository-fact-ledger.test.mjs`

**Interfaces:**
- Produces: `RepositoryFactLedger`, `createBranchFingerprint(branchContext)`, `createFactInvalidationKey(fact)`.

- [ ] Write failing tests proving immutable cited facts, branch/worktree rejection, source-hash invalidation, and editor overlay isolation.
- [ ] Run `node --test tests/repository-fact-ledger.test.mjs` and confirm failure because the module is missing.
- [ ] Implement the minimal in-memory bounded ledger with `record`, `query`, `validate`, and `clearOverlay`.
- [ ] Run the test and confirm all assertions pass.
- [ ] Commit `feat: add branch scoped repository fact ledger`.

### Task 2: Architecture, symbol, and runtime maps

**Files:**
- Create: `src/repository/repository-truth-map-builder.mjs`
- Create: `tests/repository-truth-map-builder.test.mjs`

**Interfaces:**
- Consumes: `RepositoryFactLedger.record()`.
- Produces: `RepositoryTruthMapBuilder.build({ project, files, symbols, imports, relationshipEdges, runtimeEdges, branchContext, editorOverlays, limits })`.

- [ ] Write failing tests for public/internal APIs, database schema, configuration, build target, service/layer/domain boundaries, definitions/references/callers/types/tests, and request/event/process/state/data-flow relations.
- [ ] Run the test and confirm missing-module failure.
- [ ] Implement bounded cited maps and explicit unknowns; reject provider edges without source-hash citations.
- [ ] Run the test and confirm pass.
- [ ] Commit `feat: build cited repository truth maps`.

### Task 3: Evidence query planner

**Files:**
- Create: `src/repository/repository-evidence-query-planner.mjs`
- Create: `tests/repository-evidence-query-planner.test.mjs`

**Interfaces:**
- Produces: `RepositoryEvidenceQueryPlanner.plan(request)` and `.execute(request, providers)`.

- [ ] Write failing tests for exact stage order, remaining-budget propagation, unavailable stages, cited result requirements, threshold stop, and ambiguous results.
- [ ] Run the test and confirm missing-module failure.
- [ ] Implement the deterministic staged planner.
- [ ] Run the test and confirm pass.
- [ ] Commit `feat: add repository evidence query planner`.

### Task 4: Paged viewer and zoom API

**Files:**
- Create: `src/repository/repository-truth-viewer.mjs`
- Create: `tests/repository-truth-viewer.test.mjs`

**Interfaces:**
- Produces: `RepositoryTruthViewer.open(twin, request)` and signed opaque cursor helpers.

- [ ] Write failing tests for workspace-to-span zoom, bounded node loading, cursor continuation, neighborhood limits, and corrupt cursor rejection.
- [ ] Run the test and confirm missing-module failure.
- [ ] Implement deterministic page ordering and cursor validation.
- [ ] Run the test and confirm pass.
- [ ] Commit `feat: add paged repository truth viewer`.

### Task 5: Digital twin v2 integration

**Files:**
- Modify: `src/repository/repository-digital-twin-service.mjs`
- Modify: `src/repository/repository-intelligence-fabric.mjs`
- Modify: `tests/repository-digital-twin-service.test.mjs`
- Modify: `tests/repository-intelligence-fabric-app-wiring.test.mjs`
- Create: `tests/repository-truth-plane-integration.test.mjs`

**Interfaces:**
- `RepositoryDigitalTwinService.build(projectId, options)` returns v2 plus v1-compatible fields.
- Add `query(projectId, request)`, `zoom(projectId, request)`, and `validateFacts(projectId, branchContext)`.

- [ ] Add failing integration tests using real temporary files, repository index, real Git branch/worktree/dirty state, and an unsaved editor overlay.
- [ ] Run targeted tests and confirm failure for missing v2 APIs.
- [ ] Integrate ledger/map/planner/viewer while retaining existing behavior.
- [ ] Add lazy fabric methods `repositoryTruth`, `queryRepositoryTruth`, and `zoomRepositoryTruth`; prove lexical fast path does not initialize them.
- [ ] Run all targeted tests and confirm pass.
- [ ] Commit `feat: integrate repository truth plane`.

### Task 6: Deterministic measurement and release verifier

**Files:**
- Create: `scripts/measure-repository-truth-plane.mjs`
- Create: `src/release/repository-truth-plane-verifier.mjs`
- Create: `scripts/verify-repository-truth-plane.mjs`
- Create: `tests/repository-truth-plane-release-gate.test.mjs`
- Modify: `src/release/full-release-matrix.mjs`

**Interfaces:**
- `measureRepositoryTruthPlane({ rootDirectory, version })` returns deterministic outcomes and `receiptSha256`.
- `verifyRepositoryTruthPlane({ rootDirectory, version, outputFile })` fails closed on missing evidence, wrong audit transitions, or non-claim drift.

- [ ] Write failing release tests for deterministic receipt, real Git fixture outcomes, exactly eleven promotions, unchanged external count, non-claims, and required matrix gate.
- [ ] Run the tests and confirm failure.
- [ ] Implement measurement and verifier; add required architecture gate `repository-truth-plane`.
- [ ] Run the tests and confirm pass.
- [ ] Commit `test: certify repository truth plane`.

### Task 7: Audit, version, documentation, and manifest

**Files:**
- Modify: `package.json`, `src/version.mjs`, `config/release-identity.json`, `README.md`
- Modify: `scripts/generate-frontier-feature-audit.mjs`
- Create: `docs/repository-truth-plane-measurement-3.3.0.json`
- Create: `docs/feature-audit-3.3.0.json`
- Create: `docs/FEATURE-COMPLETENESS-AUDIT-3.3.0.md`
- Create: `docs/REMAINING-GAPS-3.3.0.md`
- Create: `docs/LIMITATIONS-3.3.0.md`
- Create: `docs/RELEASE-3.3.0.md`
- Create: `docs/VERIFICATION-REPORT-3.3.0.md`
- Modify: `project-manifest.json`

- [ ] Generate measurement twice and compare receipts.
- [ ] Update audit generator to promote only the eleven approved IDs when 3.3 evidence exists.
- [ ] Generate audit/docs and assert summary `996/91/63/0`.
- [ ] Update release identity to `3.3.0`, preserve inherited limitations, and add Repository Truth Plane non-claims.
- [ ] Regenerate `project-manifest.json` and run version coherence.
- [ ] Commit `release: prepare Forge Studio 3.3.0`.

### Task 8: Full verification and artifacts

**Files:**
- Generated under `release/` and exported to `/mnt/data`; no generated release directory is committed unless already required by project policy.

- [ ] Run targeted Repository Truth Plane tests.
- [ ] Run `npm test` and confirm every Node test file passes.
- [ ] Run `npm run test:go`, Python SDK tests, VS Code build, ForgeOS validation, and `npm run release:matrix`.
- [ ] Confirm matrix is `72/72` on a clean release commit.
- [ ] Build source, Windows x64, update payload, VSIX, change-set, release evidence, matrix reports, manifest, integrity report, and SHA-256 list.
- [ ] Verify every archive and checksum, update export `project-manifest.json` entries, and expose only files created or changed in this response.
