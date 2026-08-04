# Memory, Skill, Replay & Resource Admission 2.26.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a governed versioned Memory OS, value-driven replay and skill compilation, stability–plasticity promotion gates, and utility-per-MB resource admission without weakening Forge Studio's local-first safety or startup budgets.

**Architecture:** Add focused services under `src/memory/`, `src/skills/`, `src/runtime/`, and `src/storage/`, then expose them through one lazy `MemorySkillResourcePlane` owned by `DecisionPlane` and projected by `MissionResourceFabric`. Reuse the existing SQLite store, causal episodes, provider/LSP pools, process-tree ledger, resource governor, context artifact APIs, and canonical receipt machinery. No new top-level database or direct import in `src/app.mjs` is permitted.

**Tech Stack:** Node.js ESM, `node:test`, `node:sqlite`, filesystem atomic writes, canonical SHA-256 receipts, existing Forge Studio release tooling.

## Global Constraints

- No chain-of-thought, raw prompt, raw model output, secret, environment dump, authorization header, or hidden rationale may be persisted.
- Memory/skill policy learning remains shadow/governed in 2.26.0; no autonomous production promotion.
- A memory or skill write requires public evidence and a content-addressed receipt.
- Resource termination requires an owned lease and process identity evidence.
- Simple low-risk tasks keep the current fast path.
- `src/app.mjs` must stay at or below 160 static imports and 180 constructor expressions.
- Historical frontier audit counts must remain version-aware.

---

### Task 1: Versioned Memory Operating System

**Files:**
- Create: `src/memory/memory-operating-system.mjs`
- Create: `tests/memory-operating-system.test.mjs`
- Modify: `src/context/context-memory-center-service.mjs`

**Interfaces:**
- Consumes: existing `store.db`, `MemoryService`, `ProjectMemorySidecar`, project/actor/evidence receipts.
- Produces: `MemoryOperatingSystem.apply(input) -> forge.memory-operation.v1`, `versions(memoryId)`, `retrieve(projectId, query, options)`.

- [ ] **Step 1: Write failing tests**

Create tests using a real temporary `StudioStore` proving `suppress`, `deprioritize`, `invalidate`, `archive`, `abstract`, and privacy `delete`; each operation creates an immutable version with `validFromMs`, `validUntilMs`, parent version, layer, actor, source hash, and receipt. Prove task-scoped suppression does not invalidate the global memory, schema retrieval yields to a matching exception, and raw private fields are rejected.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/memory-operating-system.test.mjs`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement lazy SQLite version tables and operations**

Create `memory_versions`, `memory_scopes`, and `memory_tombstones` lazily. Preserve existing `memory_items` compatibility. Add bounded user operations to `ContextMemoryCenterService` without changing its existing snapshot contract.

- [ ] **Step 4: Verify GREEN and memory regressions**

Run: `node --test tests/memory-operating-system.test.mjs tests/memory-service.test.mjs tests/memory-sidecar.test.mjs tests/context-memory-center-service.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

`git add src/memory/memory-operating-system.mjs src/context/context-memory-center-service.mjs tests/memory-operating-system.test.mjs && git commit -m "feat: add versioned memory operating system"`

### Task 2: Governed Memory Policy and Consolidation

**Files:**
- Create: `src/memory/memory-policy-controller.mjs`
- Create: `tests/memory-policy-controller.test.mjs`

**Interfaces:**
- Consumes: proposed operation, recurrence, surprise, verified value, commitment, user action, memory version state.
- Produces: `MemoryPolicyController.decide(input) -> forge.memory-policy-decision.v1`.

- [ ] **Step 1: Write failing tests**

Cover `ADD`, `UPDATE`, `DELETE`, `RETRIEVE`, `SUMMARIZE`, and `NOOP`; prove consolidation is denied with only self-reported usefulness, allowed by recurrence or verified value, privacy delete overrides retention, and policy candidates remain shadow-only.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/memory-policy-controller.test.mjs`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement deterministic governed decisions**

Return trigger scores, reasons, required receipts, proposed operation, `shadowOnly: true`, and claims that hidden reasoning is not stored. Unknown operations fail closed.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/memory-policy-controller.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

`git add src/memory/memory-policy-controller.mjs tests/memory-policy-controller.test.mjs && git commit -m "feat: govern memory consolidation"`

### Task 3: Scheduled Replay and Model-Time

**Files:**
- Create: `src/memory/model-time-clock.mjs`
- Create: `src/memory/replay-scheduler.mjs`
- Create: `tests/replay-scheduler.test.mjs`

**Interfaces:**
- Consumes: causal episode summaries, prediction error, conflict, revert, transfer value, commitments, policy/schema/correction changes.
- Produces: signed model-time snapshots and bounded replay queue.

- [ ] **Step 1: Write failing tests**

Prove model-time advances from policy drift/schema change/correction rate rather than raw wall-clock steps; high prediction error and reverted episodes outrank routine successes; saturation lowers repeat priority; completed commitments are not replayed; scheduler never calls a model.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/replay-scheduler.test.mjs`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement bounded scoring and queue**

Add deterministic normalized scoring, replay reason, prior replay count, next eligible model-time, queue cap, and receipt. Store only episode IDs and public metrics.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/replay-scheduler.test.mjs tests/episodic-binder.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

`git add src/memory/model-time-clock.mjs src/memory/replay-scheduler.mjs tests/replay-scheduler.test.mjs && git commit -m "feat: schedule value-driven replay"`

### Task 4: Compositional Skill Compiler and Lineage

**Files:**
- Create: `src/skills/compositional-skill-compiler.mjs`
- Create: `src/skills/skill-registry.mjs`
- Create: `tests/compositional-skill-compiler.test.mjs`

**Interfaces:**
- Consumes: verified workflow episodes, typed parameters, preconditions, effects, invariants, verifier, costs, rollback.
- Produces: immutable skill drafts, lineage records, compatibility decisions, transfer receipts.

- [ ] **Step 1: Write failing tests**

Prove a verified workflow compiles to a skill with preconditions/parameters/effects/invariants/verifier/failure signatures/cost/rollback/decomposition; unverified episodes fail; incompatible effects block recombination; lineage records parent/fork/merge/rejection; transfer test must use different repository or vocabulary evidence.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/compositional-skill-compiler.test.mjs`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement compiler and bounded registry**

Use canonical type descriptors, exact source episode receipts, immutable revisions, stable IDs, and public receipts. Registry states are `draft`, `transfer-tested`, `promoted`, `rejected`, and `revoked`.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/compositional-skill-compiler.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

`git add src/skills/compositional-skill-compiler.mjs src/skills/skill-registry.mjs tests/compositional-skill-compiler.test.mjs && git commit -m "feat: compile transferable skills"`

### Task 5: Stability–Plasticity Guard

**Files:**
- Create: `src/skills/stability-plasticity-guard.mjs`
- Create: `tests/stability-plasticity-guard.test.mjs`

**Interfaces:**
- Consumes: baseline/candidate transfer results, memory growth, correction rate, retention, policy lineage.
- Produces: `StabilityPlasticityGuard.evaluate(input) -> forge.stability-plasticity-decision.v1`.

- [ ] **Step 1: Write failing tests**

Cover successful forward transfer, backward regression, negative transfer on a new repository, excessive memory growth, missing exception retention, exact rollback target, and candidate success only on its source task.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/stability-plasticity-guard.test.mjs`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement promotion decision**

Compute forward/backward/negative transfer, late-task learning, criteria retention, and growth ratio. Promotion requires transfer-tested skill, no critical regression, bounded memory growth, lineage, and rollback receipt.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/stability-plasticity-guard.test.mjs tests/compositional-skill-compiler.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

`git add src/skills/stability-plasticity-guard.mjs tests/stability-plasticity-guard.test.mjs && git commit -m "feat: guard stability and plasticity"`

### Task 6: Resource Admission, Viability Region, and Device Doctor

**Files:**
- Create: `src/runtime/resource-admission-controller.mjs`
- Create: `src/runtime/viability-region-controller.mjs`
- Create: `src/runtime/local-device-doctor.mjs`
- Create: `tests/resource-admission-controller.test.mjs`

**Interfaces:**
- Consumes: governor/process-ledger snapshots, planned resource kind, expected verified utility, RSS/CPU/time/FD/process cost, system/disk measurements.
- Produces: owned resource lease, admit/deny/evict decision, viability forecast, Lite/Balanced/Performance recommendation.

- [ ] **Step 1: Write failing tests**

Prove browser is denied for a backend-only task when utility/MB is low, embedding is unloaded before a predicted browser/test demand, high-value targeted test is admitted, viability bounds block irreversible work, every lease tracks `rssMbSeconds`, and Device Doctor explains its profile from real-style metrics.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/resource-admission-controller.test.mjs`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement deterministic leases and forecast**

Support resource kinds model/browser/terminal/LSP/embedding/indexer/test/provider. Add idle TTL, reversibility, process root, mission/task/owner, budgets, expected utility, and signed decisions. Do not launch or kill resources directly.

- [ ] **Step 4: Verify GREEN and governor regressions**

Run: `node --test tests/resource-admission-controller.test.mjs tests/resource-governor.test.mjs tests/mission-resource-fabric.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

`git add src/runtime/resource-admission-controller.mjs src/runtime/viability-region-controller.mjs src/runtime/local-device-doctor.mjs tests/resource-admission-controller.test.mjs && git commit -m "feat: add utility-based resource admission"`

### Task 7: Content-Addressed Artifact Store and Bounded Output

**Files:**
- Create: `src/storage/content-addressed-artifact-store.mjs`
- Create: `tests/content-addressed-artifact-store.test.mjs`

**Interfaces:**
- Consumes: raw bytes/text, owner references, artifact kind, visibility policy.
- Produces: SHA-256 artifact record, bounded projection, cursor/offset reads, deletion/tombstone receipt.

- [ ] **Step 1: Write failing tests**

Use a real temporary filesystem to prove duplicate payloads are stored once, hot projection contains only summary/preview/cursor/offset, context receives bounded output, raw bytes are retrievable by hash, secret-like metadata is rejected, and privacy deletion leaves a tombstone receipt.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/content-addressed-artifact-store.test.mjs`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement atomic content-addressed storage**

Write blobs under hash-derived paths with atomic rename. Keep a bounded in-memory metadata index and optional SQLite reference table supplied by the caller. Never duplicate raw payload in JSON snapshots.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/content-addressed-artifact-store.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

`git add src/storage/content-addressed-artifact-store.mjs tests/content-addressed-artifact-store.test.mjs && git commit -m "feat: store bounded artifacts by content hash"`

### Task 8: Resource Lifecycle and Lazy Memory–Skill–Resource Plane

**Files:**
- Create: `src/runtime/resource-lifecycle-coordinator.mjs`
- Create: `src/runtime/memory-skill-resource-plane.mjs`
- Create: `tests/memory-skill-resource-plane.test.mjs`
- Modify: `src/decision/decision-plane.mjs`
- Modify: `src/runtime/mission-resource-fabric.mjs`
- Modify: `src/context/context-memory-center-service.mjs`

**Interfaces:**
- Consumes: Tasks 1–7 services plus existing process ledger/provider host/LSP pool/governor.
- Produces: lazy facade methods, bounded public snapshot, idle eviction/orphan cleanup receipts.

- [ ] **Step 1: Write failing integration tests**

Prove ordinary decision tasks do not instantiate the plane; memory operation loads only memory services; replay/skill/admission load on demand; mission stop with matching owned process lease requests tree termination; mismatched PID identity is not killed; snapshots omit raw memory/output/commands.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/memory-skill-resource-plane.test.mjs`
Expected: FAIL with module-not-found or missing `DecisionPlane` methods.

- [ ] **Step 3: Implement lazy facade and lifecycle coordinator**

Add `DecisionPlane.memorySkillResource` getter and wrapper methods for memory, replay, skill, stability, admission, artifacts, and device profile. Project the plane through `MissionResourceFabric.publicView()` without adding a direct import to `src/app.mjs`.

- [ ] **Step 4: Verify GREEN and broad regressions**

Run: `node --test tests/memory-skill-resource-plane.test.mjs tests/decision-plane.test.mjs tests/mission-resource-fabric.test.mjs tests/context-memory-center-service.test.mjs tests/provider-session-host.test.mjs tests/lsp-session-pool.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

`git add src/runtime/resource-lifecycle-coordinator.mjs src/runtime/memory-skill-resource-plane.mjs src/decision/decision-plane.mjs src/runtime/mission-resource-fabric.mjs src/context/context-memory-center-service.mjs tests/memory-skill-resource-plane.test.mjs && git commit -m "feat: integrate memory skill resource plane"`

### Task 9: Release Gate, Measurement, Audit, and Version 2.26.0

**Files:**
- Create: `src/release/memory-skill-resource-os-verifier.mjs`
- Create: `scripts/measure-memory-skill-resource-os.mjs`
- Create: `scripts/verify-memory-skill-resource-os.mjs`
- Create: `tests/memory-skill-resource-os-release-gate.test.mjs`
- Modify: `src/release/full-release-matrix.mjs`
- Modify: version surfaces, release docs, frontier audit generator, manifest, checksum, and artifact tooling.

**Interfaces:**
- Consumes: deterministic local fixture covering Tasks 1–8 and platform-safe child-process/resource adapters.
- Produces: 2.26 measurement, audit transition, release gate, matrix entry, artifacts, and non-claims.

- [ ] **Step 1: Write failing release-gate test**

Require evidence for six memory operations, version/validity history, layer/exception retrieval, governed consolidation, model-time replay, typed skill and transfer block, stability metrics, utility-per-MB admission, viability prediction, content-addressed bounded output, lazy lifecycle, privacy, and version-aware 1,150-item audit.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/memory-skill-resource-os-release-gate.test.mjs`
Expected: FAIL because verifier/measurement/version 2.26 do not exist.

- [ ] **Step 3: Implement measurement and release verifier**

Generate deterministic local evidence and raw receipts. State that production learned memory policy, long-term patch/skill survival, broad cross-repository transfer, direct kernel enforcement on all OSes, and production neural embedding unload remain unproven.

- [ ] **Step 4: Update version and release surfaces**

Set all product/package/extension/release identities to `2.26.0`, add required matrix gates `memory-skill-os` and `resource-admission-control`, regenerate inherited measurements on the 2.26 tree, and update frontier audit counts without rewriting historical release counts.

- [ ] **Step 5: Run focused and full verification**

Run focused tests and all architecture gates, then `npm test`, then the full release matrix on one clean commit. Build source, Windows, update, VSIX, NolaneNative optional pack, release evidence, change-set, manifests, and checksums. Verify the exact `/mnt/data` copies before publication.
