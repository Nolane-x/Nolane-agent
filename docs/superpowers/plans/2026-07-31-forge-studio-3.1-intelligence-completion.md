# Forge Studio 3.1 Intelligence Completion Kernel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement and certify the 13 internal requirements still marked `not_implemented` after Forge Studio 3.0.0.

**Architecture:** Add four focused, adapter-driven services for verified context learning, paged vectors, repository-twin enrichment, and program/patch analysis. Integrate them lazily through `RepositoryIntelligenceFabric`, then add one deterministic measurement and one mandatory release gate that promotes exactly the 13 evidenced audit items.

**Tech Stack:** Node.js ESM, `node:test`, existing canonical JSON/SHA-256 utilities, caller-supplied Git/AST/worktree/verifier adapters, existing release/audit tooling.

## Global Constraints

- Core remains local-first and provider-neutral.
- No cloud sandbox, autonomous pull request, merge, publish, deployment, production write, policy promotion, verifier disablement, or autonomy expansion.
- Every public receipt is bounded, canonical, deeply frozen, content-addressed, and secret-safe.
- Learning accepts only verified outcomes with exact receipt provenance.
- Unknown dynamic program edges remain ambiguous; they are never guessed.
- Audit promotion is limited to requirements `30.13`, `30.14`, `30.15`, `31.12`, `32.5`, `32.8`, `32.13`, `32.16`, `33.6`, `33.7`, `36.12`, `36.13`, and `36.17`.
- All production behavior follows RED → GREEN → regression → commit.

---

### Task 1: Completion receipt utilities

**Files:**
- Create: `src/intelligence-completion/completion-utils.mjs`
- Test: `tests/intelligence-completion-utils.test.mjs`

**Interfaces:**
- Produces: `text(value,label,max)`, `sha(value,label)`, `boundedArray(value,label,max)`, `finite(value,label,min,max)`, `signed(base)`, `redacted(value,max)`.

- [ ] **Step 1: Write failing tests** for invalid SHA-256, non-finite numbers, oversized arrays, secret redaction, deterministic receipt hashes, and recursive immutability.
- [ ] **Step 2: Run RED:** `node --test tests/intelligence-completion-utils.test.mjs`; expect module-not-found.
- [ ] **Step 3: Implement utilities** using `vendor/forge-os/src/core/canonical-json.mjs` and `src/security/redaction.mjs`.
- [ ] **Step 4: Run GREEN:** `node --test tests/intelligence-completion-utils.test.mjs`; expect pass.
- [ ] **Step 5: Commit:** `feat(intelligence): add completion receipt utilities`.

### Task 2: Verified context learning and ablation

**Files:**
- Create: `src/intelligence-completion/context-learning-kernel.mjs`
- Test: `tests/context-learning-kernel.test.mjs`

**Interfaces:**
- Consumes: completion utilities; optional adapters `{ dependencyNeighbors, gitSignals, testSignals }`.
- Produces: `expandQueries(input)`, `recordVerifiedOutcome(input)`, `rankEvidenceTypes(input)`, `runAblationReplay(input)`, `snapshot()`.

- [ ] **Step 1: Write failing tests** proving expansion includes exact symbols, stack frames, failing tests, Git paths/commits, dependency neighbors, semantic fallback, and counter-evidence; duplicate queries are removed while provenance is retained.
- [ ] **Step 2: Add failing tests** proving only a receipt matching `/^[a-f0-9]{64}$/` with `verificationStatus: 'passed'` and `verified: true` changes utility; unverified outcomes do not alter ranking.
- [ ] **Step 3: Add failing ablation tests** using a verifier adapter whose score drops only when required cards are removed; expect `required`, `unnecessary`, and `inconclusive` classifications plus unchanged verification contract hash.
- [ ] **Step 4: Run RED:** `node --test tests/context-learning-kernel.test.mjs`.
- [ ] **Step 5: Implement bounded query extraction**, verified-only utility updates keyed by task type and evidence type, and sequential one-card ablation with adapter timeout/error conversion to `inconclusive`.
- [ ] **Step 6: Run GREEN and regressions:** `node --test tests/context-learning-kernel.test.mjs tests/context-intelligence.test.mjs tests/context-utility-selector.test.mjs`.
- [ ] **Step 7: Commit:** `feat(context): add verified context learning and ablation`.

### Task 3: Paged semantic vector store

**Files:**
- Create: `src/intelligence-completion/paged-vector-store.mjs`
- Test: `tests/paged-vector-store.test.mjs`

**Interfaces:**
- Consumes: records `{ id, vector: Int8Array|number[], metadata, contentSha256 }` and optional filesystem adapter.
- Produces: `build(input)`, `search(input)`, `readPage(input)`, `verify()`, `snapshot()`.

- [ ] **Step 1: Write failing tests** building at least six records with `pageSize: 2`; assert manifest has three pages, each page has checksum/dimension/count, and a query with `pageIds: [onePage]` reads exactly one page.
- [ ] **Step 2: Add failing tests** for checksum corruption, dimension mismatch, page over-budget, duplicate IDs, and proof that `peakLoadedBytes < totalVectorBytes` for a multi-page index.
- [ ] **Step 3: Run RED:** `node --test tests/paged-vector-store.test.mjs`.
- [ ] **Step 4: Implement binary page encoding** with a JSON manifest, page-local decoding, bounded cosine/dot scoring for INT8 vectors, and telemetry `{ pagesRead, bytesRead, peakLoadedBytes, totalVectorBytes }`.
- [ ] **Step 5: Run GREEN and semantic regressions:** `node --test tests/paged-vector-store.test.mjs tests/secure-semantic-index.test.mjs tests/semantic-dependency-intelligence-service.test.mjs`.
- [ ] **Step 6: Commit:** `feat(repository): add paged semantic vector storage`.

### Task 4: Repository twin enrichment

**Files:**
- Create: `src/intelligence-completion/repository-intelligence-completion-service.mjs`
- Test: `tests/repository-intelligence-completion-service.test.mjs`

**Interfaces:**
- Produces: `recordCommitArchitecture(input)`, `recordIssueCodeReference(input)`, `buildModuleMap(input)`, `detectArchitectureZones(input)`, `buildGitRiskProfile(input)`, `snapshot()`.

- [ ] **Step 1: Write failing relation tests** requiring commit SHA, source hashes, branch, evidence kind (`observed` or `inferred`), confidence, and explicit claims `{ causalityProven: false }`.
- [ ] **Step 2: Write failing module-map tests** for responsibility, dependency direction, owner, public surface, source citations, and deterministic module receipts.
- [ ] **Step 3: Write failing architecture-zone tests** using explicit path/import/annotation rules for patterns, conventions, legacy zones, and security-critical zones; every finding must carry citations and invalidation keys.
- [ ] **Step 4: Write failing Git-risk tests** for ownership, churn, hotspot score, regression count, recent commits, bounded history, and stale-branch rejection.
- [ ] **Step 5: Run RED:** `node --test tests/repository-intelligence-completion-service.test.mjs`.
- [ ] **Step 6: Implement the service** with no Git subprocesses; all repository history comes from caller-supplied normalized records.
- [ ] **Step 7: Run GREEN and twin regressions:** `node --test tests/repository-intelligence-completion-service.test.mjs tests/repository-digital-twin-service.test.mjs tests/codebase-knowledge-graph-service.test.mjs`.
- [ ] **Step 8: Commit:** `feat(repository): enrich repository twin intelligence`.

### Task 5: Bounded CFG and interprocedural DFG

**Files:**
- Create: `src/intelligence-completion/program-analysis-kernel.mjs`
- Test: `tests/program-analysis-kernel.test.mjs`

**Interfaces:**
- Consumes normalized IR `{ functions:[{ id, entry, nodes, calls }] }` where nodes contain `id`, `kind`, `next`, `reads`, `writes`, and source citation.
- Produces: `buildControlFlow(input)`, `buildDataFlow(input)`, `snapshot()`.

- [ ] **Step 1: Write failing CFG tests** for entry/exit, branch, loop back-edge, unreachable node, source citation, graph budget, and ambiguous dynamic call edges.
- [ ] **Step 2: Write failing DFG tests** tracing definitions to uses across direct calls within depth/node budgets, retaining unresolved/ambiguous flows instead of fabricating targets.
- [ ] **Step 3: Run RED:** `node --test tests/program-analysis-kernel.test.mjs`.
- [ ] **Step 4: Implement deterministic graph construction**, cycle-safe traversal, bounded interprocedural propagation, confidence labels, and signed graph receipts.
- [ ] **Step 5: Run GREEN and AST regressions:** `node --test tests/program-analysis-kernel.test.mjs tests/ast-intelligence-service.test.mjs tests/relationship-graph-fusion-service.test.mjs`.
- [ ] **Step 6: Commit:** `feat(repository): add bounded control and data flow graphs`.

### Task 6: Temporal variable lineage

**Files:**
- Create: `src/intelligence-completion/variable-lineage-service.mjs`
- Test: `tests/variable-lineage-service.test.mjs`

**Interfaces:**
- Produces: `registerBinding(input)`, `transitionBinding(bindingId,input)`, `resolve(input)`, `snapshot()`.

- [ ] **Step 1: Write failing tests** for rename, move, type, nullability, scope, serialization, and database mapping transitions with exact before/after source hashes.
- [ ] **Step 2: Add failing tests** rejecting uncited transitions, incompatible type changes without explicit compatibility evidence, branch mismatch, cycles, duplicate transition IDs, and ambiguous resolution.
- [ ] **Step 3: Run RED:** `node --test tests/variable-lineage-service.test.mjs`.
- [ ] **Step 4: Implement immutable temporal chains**, stable logical IDs, alias lookup, compatibility evidence, and explicit `resolved`, `ambiguous`, or `not-found` results.
- [ ] **Step 5: Run GREEN and patch regressions:** `node --test tests/variable-lineage-service.test.mjs tests/semantic-patch-analyzer.test.mjs tests/unified-patch-completeness.test.mjs`.
- [ ] **Step 6: Commit:** `feat(construction): track temporal variable lineage`.

### Task 7: Counterfactual patch ablation

**Files:**
- Create: `src/intelligence-completion/counterfactual-patch-ablator.mjs`
- Test: `tests/counterfactual-patch-ablator.test.mjs`

**Interfaces:**
- Consumes: `{ candidateId, verificationContractSha256, hunks, adapter }`; adapter provides `createIsolatedCandidate`, `removeHunk`, `verify`, and `dispose`.
- Produces: `run(input)` returning per-hunk `required|unnecessary|inconclusive` classifications and an immutable receipt.

- [ ] **Step 1: Write failing tests** proving each hunk is removed in a fresh isolated candidate, the exact original verification contract is reused, and cleanup runs even after adapter failure.
- [ ] **Step 2: Add failing tests** for baseline verification failure, mismatched contract receipt, verification regression, timeout/error conversion, and no apply/merge/publish capability.
- [ ] **Step 3: Run RED:** `node --test tests/counterfactual-patch-ablator.test.mjs`.
- [ ] **Step 4: Implement sequential bounded ablation** with baseline-first gating and per-hunk receipts.
- [ ] **Step 5: Run GREEN and construction/world regressions:** `node --test tests/counterfactual-patch-ablator.test.mjs tests/candidate-patch-selector.test.mjs tests/counterfactual-simulator.test.mjs`.
- [ ] **Step 6: Commit:** `feat(construction): add counterfactual patch ablation`.

### Task 8: Lazy fabric integration

**Files:**
- Modify: `src/repository/repository-intelligence-fabric.mjs`
- Test: `tests/repository-intelligence-completion-fabric.test.mjs`
- Modify: `tests/decision-plane-app-wiring.test.mjs` only if lifecycle contract requires it.

**Interfaces:**
- Adds fabric methods: `expandCompletionQueries`, `recordCompletionContextOutcome`, `runCompletionContextAblation`, `completionContextSnapshot`, `completionVectorBuild`, `completionVectorSearch`, `recordCompletionCommitArchitecture`, `recordCompletionIssueReference`, `completionModuleMap`, `completionArchitectureZones`, `completionGitRisk`, `completionControlFlow`, `completionDataFlow`, `registerCompletionVariable`, `transitionCompletionVariable`, `resolveCompletionVariable`, `runCompletionPatchAblation`, `completionSnapshot`.

- [ ] **Step 1: Write failing lifecycle tests** proving lexical/index fast paths do not instantiate completion services, each service is lazy, snapshots are privacy-safe, and close disposes stores/adapters.
- [ ] **Step 2: Run RED:** `node --test tests/repository-intelligence-completion-fabric.test.mjs`.
- [ ] **Step 3: Implement four private lazy service slots** and bounded wrappers without importing completion modules from `src/app.mjs`.
- [ ] **Step 4: Run GREEN and fabric/app regressions:** `node --test tests/repository-intelligence-completion-fabric.test.mjs tests/repository-intelligence-fabric.test.mjs tests/decision-plane-app-wiring.test.mjs`.
- [ ] **Step 5: Commit:** `feat(repository): integrate intelligence completion services lazily`.

### Task 9: Measurement, release gate, audit, and version 3.1.0

**Files:**
- Create: `scripts/measure-intelligence-completion.mjs`
- Create: `src/release/intelligence-completion-kernel-verifier.mjs`
- Create: `scripts/verify-intelligence-completion-kernel.mjs`
- Create: `tests/intelligence-completion-release-gate.test.mjs`
- Modify: `src/release/full-release-matrix.mjs`
- Modify: `tests/full-release-matrix.test.mjs`
- Modify: `scripts/generate-frontier-feature-audit.mjs`
- Modify: version surfaces and release docs.

**Interfaces:**
- Produces required gate `intelligence-completion-kernel`, `docs/intelligence-completion-measurement-3.1.0.json`, 3.1 audit/gap/limitation/release reports, and coherent version identity.

- [ ] **Step 1: Write failing gate tests** requiring direct source/tests for all 13 items, deterministic measurement receipt, exact audit transitions, unchanged external-gate count, non-claims, lazy integration, and page-memory evidence.
- [ ] **Step 2: Run RED:** `node --test tests/intelligence-completion-release-gate.test.mjs tests/full-release-matrix.test.mjs`.
- [ ] **Step 3: Implement deterministic measurement** with in-memory adapters covering all four services and resource telemetry.
- [ ] **Step 4: Implement verifier and matrix registration** as a mandatory architecture gate.
- [ ] **Step 5: Update audit generation** so exactly the 13 IDs move from `not_implemented` to `verified_source_test`; regenerate completeness and remaining-gap reports.
- [ ] **Step 6: Update all version surfaces to `3.1.0`**, add `RELEASE-3.1.0.md`, `VERIFICATION-REPORT-3.1.0.md`, `ADVERSARIAL-WEAKNESS-MATRIX-3.1.0.md`, and `LIMITATIONS-3.1.0.md`.
- [ ] **Step 7: Run direct gate, version coherence, audit counts, and complete historical architecture gate regressions.**
- [ ] **Step 8: Commit:** `chore(release): prepare Forge Studio 3.1.0`.

### Task 10: Full verification, packaging, and export

**Files:**
- Generated under `release/` and exported to `/mnt/data`.
- Modify: `project-manifest.json`.

**Interfaces:**
- Produces source ZIP, Windows/Electron ZIP, update payload ZIP, VSIX, release evidence ZIP, change-set ZIP, full matrix MD/JSON, checksums, and current-response manifest entries.

- [ ] **Step 1: Run `npm test`** on the clean release commit.
- [ ] **Step 2: Run `npm run release:matrix`** and confirm every required gate passes on the same commit.
- [ ] **Step 3: Build all canonical release artifacts** using existing scripts; do not invent unsupported packages.
- [ ] **Step 4: Update `project-manifest.json`** with only files created or changed in this response, including relative path, filename, MIME type, version, status, and description.
- [ ] **Step 5: Verify SHA-256, ZIP/VSIX integrity, source/version identity, matrix receipt, audit counts, evidence logs, and clean Git status.**
- [ ] **Step 6: Export all created or changed artifacts to `/mnt/data` and expose them to the user.**
