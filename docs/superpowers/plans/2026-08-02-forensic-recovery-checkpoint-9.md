# Forensic Recovery Checkpoint 9 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and certify a bounded type-aware multi-file refactor skill and deterministic property-based solver verification, then release Checkpoint 9 through a new fail-closed matrix gate.

**Architecture:** A constrained JavaScript module graph separates exported/imported bindings from unrelated identifiers. A patch-only refactor engine and temporary-workspace transfer lab produce public receipts. Independent seeded reference solvers validate finite SMT and bounded Datalog behavior before promotion v5.

**Tech Stack:** Node.js ESM, node:test, child_process argv execution with `shell:false`, SHA-256 content addressing, existing Nolane release matrix and forensic tooling.

## Global Constraints

- Preserve all Checkpoint 8 behavior and release gates.
- Never execute source while computing refactor patches.
- Never write outside temporary workspaces during mission collection.
- Keep hidden reasoning storage false in every dataset, receipt, skill, and promotion artifact.
- Keep all NolaneNative/frontier/external certification claims false.

---

### Task 1: Type-aware module graph

**Files:**
- Create: `src/small-model/module-symbol-graph.mjs`
- Create: `tests/small-model-module-symbol-graph.test.mjs`

**Interfaces:**
- Produces: `buildModuleSymbolGraph({ files, entrypoints })`
- Produces graph records for modules, exports, imports, local bindings, and resolved named-import edges.

- [ ] Write failing tests for named export/import resolution, alias handling, ambiguous exports, stale hashes, traversal, and public-state receipts.
- [ ] Run the focused test and verify RED.
- [ ] Implement deterministic parsing for the constrained ES-module subset.
- [ ] Run the focused test and verify GREEN.
- [ ] Commit.

### Task 2: Multi-file refactor engine and transfer lab

**Files:**
- Create: `src/small-model/multi-file-refactor-engine.mjs`
- Create: `src/small-model/checkpoint-9-refactor-pack.mjs`
- Create: `src/small-model/checkpoint-9-refactor-lab.mjs`
- Create fixtures under: `fixtures/checkpoint-9-refactor/`
- Create: `tests/small-model-checkpoint-9-refactor.test.mjs`

**Interfaces:**
- Consumes: `buildModuleSymbolGraph()`
- Produces: `MultiFileRefactorEngine.plan()` patch sets and `Checkpoint9RefactorLab.collect()/verify()` mission receipts.

- [ ] Write failing tests for declaration/import/reference rename, comment/string/property preservation, held-out transfer, mutation failure, repair success, rollback, and source immutability.
- [ ] Verify RED.
- [ ] Implement patch-only planning and temporary-workspace execution.
- [ ] Verify GREEN.
- [ ] Commit.

### Task 3: Deterministic property-based solver verifier

**Files:**
- Create: `src/small-model/solver-property-verifier.mjs`
- Create: `tests/small-model-solver-property-verifier.test.mjs`

**Interfaces:**
- Produces: `verifyFiniteSmtProperties({ seeds, casesPerSeed, budgets })`
- Produces: `verifyBoundedDatalogProperties({ seeds, casesPerSeed, budgets })`

- [ ] Write failing tests for deterministic generation, reference equivalence, UNSAT/SAT coverage, Datalog convergence, tamper rejection, and budget failure.
- [ ] Verify RED.
- [ ] Implement independent reference enumeration and fixed-point evaluators.
- [ ] Verify GREEN.
- [ ] Commit.

### Task 4: Checkpoint 9 portfolio and promotion v5

**Files:**
- Create: `src/small-model/checkpoint-9-mission-portfolio.mjs`
- Create: `src/small-model/checkpoint-9-evidence-bundle.mjs`
- Modify: `src/small-model/verified-skill-registry.mjs`
- Modify: `src/small-model/foundation-service.mjs`
- Modify: `src/server/routes.mjs`
- Create: `tests/small-model-checkpoint-9-foundation.test.mjs`
- Create: `tests/small-model-checkpoint-9-http.test.mjs`
- Create: `tests/small-model-checkpoint-9-promotion.test.mjs`

**Interfaces:**
- Produces: `prepareCheckpoint9Evidence()`, `promoteCheckpoint9Suite()`, `checkpoint9Status()`, `executeCheckpoint9Refactor()`.

- [ ] Write failing tests for portfolio lineage, promotion approval, property proof requirements, unsafe path rejection, and authenticated HTTP lifecycle.
- [ ] Verify RED.
- [ ] Implement portfolio, evidence bundle, promotion v5, Foundation methods, and routes.
- [ ] Verify GREEN.
- [ ] Commit.

### Task 5: Forensic gate, generator, packaging, and matrix

**Files:**
- Create: `src/forensics/recovery-checkpoint-9.mjs`
- Create: `src/forensics/checkpoint-9-delivery-plan.mjs`
- Create: `scripts/generate-checkpoint-9-evidence.mjs`
- Create: `scripts/verify-forensic-recovery-checkpoint-9.mjs`
- Create: `scripts/package-forensic-recovery-checkpoint-9.mjs`
- Modify: `scripts/full-release-matrix.mjs`
- Modify: `package.json`
- Create release tests for Checkpoint 9.

**Interfaces:**
- Produces a read-only verifier and one new matrix gate: `forensic-recovery-checkpoint-9`.

- [ ] Write failing truth-verifier, delivery-plan, and matrix tests.
- [ ] Verify RED.
- [ ] Implement generator, checkpoint verifier, delivery plan, packager, and matrix gate 156.
- [ ] Generate canonical evidence artifacts.
- [ ] Run focused tests, freshness checks, full Node regression, and Full Release Matrix 156/156.
- [ ] Package and independently verify source, patch, evidence, product artifacts, checksums, and Git cleanliness.
- [ ] Commit.
