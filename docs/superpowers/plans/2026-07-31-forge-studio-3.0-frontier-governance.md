# Forge Studio 3.0 Frontier Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-first cross-repository self-healing and self-improvement governance plane that closes section 48 with direct source, tests, release evidence, rollback, and non-claims.

**Architecture:** Add focused modules under `src/frontier/`, expose them through a lazy `FrontierGovernancePlane`, and integrate one facade into `DecisionPlane`. Release tooling adds one measurement and one mandatory gate while keeping all autonomous promotion and comparative claims locked.

**Tech Stack:** Node.js ESM, existing Forge canonical JSON/SHA-256 utilities, `node:test`, filesystem/Git adapters supplied by callers, existing release/audit tooling.

## Global Constraints

- Core remains local-first and provider-neutral.
- No production merge, publish, capability expansion, verifier disablement, audit deletion, or policy promotion.
- Every public receipt is canonical, finite, bounded, immutable, and secret-free.
- `src/app.mjs` remains within 160 imports and 180 constructor expressions.
- All new production behavior follows RED → GREEN → regression → commit.
- Comparative superiority remains locked without independent raw evidence.

---

### Task 1: Frontier receipt utilities

**Files:**
- Create: `src/frontier/frontier-utils.mjs`
- Test: `tests/frontier-utils.test.mjs`

**Interfaces:**
- Produces: `signed(base)`, `text(value,label,max)`, `sha(value,label)`, `boundedArray(value,label,max)`, `finite(value,label,min,max)`.

- [ ] Write a failing test that rejects non-finite numbers, invalid SHA-256, oversized arrays, and mutable signed receipts.
- [ ] Run `node --test tests/frontier-utils.test.mjs`; expect module-not-found failure.
- [ ] Implement canonical validation, recursive freeze, and `receiptSha256` generation using Forge canonical JSON.
- [ ] Run the test; expect pass.
- [ ] Commit `feat(frontier): add canonical governance receipts`.

### Task 2: Cross-repository workspace map

**Files:**
- Create: `src/frontier/cross-repository-workspace-map.mjs`
- Test: `tests/cross-repository-workspace-map.test.mjs`

**Interfaces:**
- Produces: `registerRepository(input)`, `registerContract(input)`, `linkDependency(input)`, `snapshot()`.

- [ ] Write failing tests for repository/version/fingerprint registration, contract ownership, dependency direction, cycle detection, and bounded snapshot provenance.
- [ ] Run the test and confirm missing-module RED.
- [ ] Implement a bounded graph with stable IDs, exact versions, owners, dependency edges, compatibility metadata, and receipts.
- [ ] Run the test and regression `node --test tests/repository-map-service.test.mjs tests/repository-digital-twin-service.test.mjs`.
- [ ] Commit `feat(frontier): add cross repository workspace map`.

### Task 3: Transactional change planner

**Files:**
- Create: `src/frontier/transactional-change-planner.mjs`
- Test: `tests/transactional-change-planner.test.mjs`

**Interfaces:**
- Consumes: workspace snapshot from Task 2.
- Produces: `compile(input)` returning ordered steps, compatibility windows, intermediate contracts, verification checkpoints, rollback coverage, and `transactional` status.

- [ ] Write failing tests proving frontend/backend/SDK/docs ordering, cycle handling, compatibility windows, and rejection of multi-root plans without all-or-rollback coverage.
- [ ] Run the test and confirm RED.
- [ ] Implement topological ordering, compatibility-window validation, and per-repository rollback/verification requirements.
- [ ] Run the test and construction regressions.
- [ ] Commit `feat(frontier): compile transactional cross repository plans`.

### Task 4: Synchronized commit chain

**Files:**
- Create: `src/frontier/synchronized-commit-chain.mjs`
- Test: `tests/synchronized-commit-chain.test.mjs`

**Interfaces:**
- Produces: `prepare(plan,input)`, `recordPreparedCommit(chainId,input)`, `recordVerification(chainId,input)`, `recordRollback(chainId,input)`, `authorizeHumanMerge(chainId,input)`.

- [ ] Write failing tests for provenance, exact baseline/commit versions, synchronized rollback, missing-repository blocking, and mandatory human merge approval.
- [ ] Run RED.
- [ ] Implement an in-memory bounded chain that never calls Git directly and records only metadata/receipts.
- [ ] Run direct tests and Git governance regressions.
- [ ] Commit `feat(frontier): govern synchronized commit chains`.

### Task 5: Post-merge sentinel and incident trace

**Files:**
- Create: `src/frontier/post-merge-sentinel.mjs`
- Create: `src/frontier/change-survival-ledger.mjs`
- Test: `tests/post-merge-sentinel.test.mjs`
- Test: `tests/change-survival-ledger.test.mjs`

**Interfaces:**
- Produces: `ingestSignal(input)`, `traceIncident(input)`, `registerChange(input)`, `observe(changeId,input)`, `evaluate(changeId)`, `shadowCredit(changeId)`.

- [ ] Write failing tests covering CI/crash/log/performance/security signals, exact receipt correlation, ambiguous-attribution blocking, 7–30 day maturity, revert/rewrite/bug/debt observations, and shadow-only credit.
- [ ] Run RED.
- [ ] Implement bounded signal storage, receipt-indexed correlation, configurable clock, maturity windows, and survival score without production routing mutation.
- [ ] Run direct tests and verified-bandit regressions.
- [ ] Commit `feat(frontier): trace incidents and change survival`.

### Task 6: Self-healing coordinator

**Files:**
- Create: `src/frontier/self-healing-coordinator.mjs`
- Test: `tests/self-healing-coordinator.test.mjs`

**Interfaces:**
- Consumes: incident trace and caller-provided `{ createWorktree, resetToBaseline }` adapter.
- Produces: `propose(input)` and `recordOutcome(proposalId,input)`.

- [ ] Write failing tests proving direct-attribution requirement, clean baseline reset before each candidate, regression-test requirement, bounded lease, rollback availability, and `mergeAllowed:false`.
- [ ] Run RED.
- [ ] Implement adapter-driven proposal creation with no raw command/output storage and no merge/publish capability.
- [ ] Run direct tests plus `tests/self-fix-controller.test.mjs` and worktree governance regressions.
- [ ] Commit `feat(frontier): add bounded self healing proposals`.

### Task 7: Cultural lineage ledger

**Files:**
- Create: `src/frontier/cultural-lineage-ledger.mjs`
- Test: `tests/cultural-lineage-ledger.test.mjs`

**Interfaces:**
- Produces: `register(input)`, `transition(id,input)`, `snapshot()` for skill, architecture, policy, and memory artifacts.

- [ ] Write failing tests for exact version/provenance/parent, fork/merge/supersede/revoke/rollback, invalid parent version, and secret-free snapshot.
- [ ] Run RED.
- [ ] Implement bounded lineage and transition validation.
- [ ] Run direct tests and skill registry regressions.
- [ ] Commit `feat(frontier): preserve cultural lineage across releases`.

### Task 8: Self-improvement constitution

**Files:**
- Create: `src/frontier/self-improvement-constitution.mjs`
- Test: `tests/self-improvement-constitution.test.mjs`

**Interfaces:**
- Produces: `evaluateCandidate(input)`, `recordStage(candidateId,input)`, `authorizePromotion(candidateId,input)`, `snapshot()`.

- [ ] Write failing tests for forbidden acceptance-criteria changes, verifier disablement, audit deletion, filesystem/network broadening, autonomy expansion, missing provenance/version/rollback, evidence thresholds by irreversibility, viability-region enforcement, stage sequence, and human approval.
- [ ] Run RED.
- [ ] Implement immutable rules and stage ledger; promotion remains shadow/canary only and never executes a policy update.
- [ ] Run direct tests and autonomy/developmental policy regressions.
- [ ] Commit `feat(frontier): enforce self improvement constitution`.

### Task 9: Lazy Frontier Governance Plane

**Files:**
- Create: `src/runtime/frontier-governance-plane.mjs`
- Modify: `src/decision/decision-plane.mjs`
- Test: `tests/frontier-governance-plane.test.mjs`
- Test: `tests/decision-plane-frontier-governance.test.mjs`

**Interfaces:**
- Produces DecisionPlane wrappers for workspace registration, plan compilation, commit-chain governance, incident/survival, self-healing, lineage, and constitution evaluation.

- [ ] Write failing tests proving fast path does not load the plane, per-service lazy loading, privacy-safe snapshot, close lifecycle, and no direct `app.mjs` frontier imports.
- [ ] Run RED.
- [ ] Implement facade and DecisionPlane integration, including `frontierGovernanceLoaded` lifecycle field.
- [ ] Update lifecycle contract regressions without removing existing fields.
- [ ] Run Decision/Cognition/Construction/Verification/Memory/World regression batch and composition verifier.
- [ ] Commit `feat(frontier): integrate lazy frontier governance plane`.

### Task 10: Release measurement and verifier

**Files:**
- Create: `scripts/measure-frontier-governance.mjs`
- Create: `src/release/frontier-safety-self-healing-verifier.mjs`
- Create: `scripts/verify-frontier-safety-self-healing.mjs`
- Create: `tests/frontier-safety-self-healing-release-gate.test.mjs`
- Modify: `src/release/full-release-matrix.mjs`
- Modify: `tests/full-release-matrix.test.mjs`

**Interfaces:**
- Produces mandatory gate `frontier-safety-and-self-healing` and `docs/frontier-governance-measurement-3.0.0.json`.

- [ ] Write a failing release-gate test requiring all section 48 behaviors, no autonomous merge/promotion, and explicit superiority non-claim.
- [ ] Run RED.
- [ ] Implement deterministic measurement with repository/worktree adapters, clock-controlled survival, constitutional candidate pipeline, and content-addressed receipt.
- [ ] Implement verifier source/evidence checks and add one required matrix gate.
- [ ] Run the gate, matrix tests, and historical frontier verifiers.
- [ ] Commit `test(release): certify frontier governance`.

### Task 11: Audit transition and 3.0 release identity

**Files:**
- Modify: `scripts/generate-frontier-feature-audit.mjs`
- Modify: historical frontier verifiers with version-aware count tables where required.
- Modify: `package.json`, `config/release-identity.json`, runtime/launcher/SDK/VS Code version surfaces.
- Create: `docs/RELEASE-3.0.0.md`
- Create: `docs/VERIFICATION-REPORT-3.0.0.md`
- Create: `docs/ADVERSARIAL-WEAKNESS-MATRIX-3.0.0.md`
- Create: `docs/LIMITATIONS-3.0.0.md`

**Interfaces:**
- Produces honest 1.150-item audit and 3.0 release documentation.

- [ ] Add 3.0 verified/partial/external sets based only on implemented source/tests; keep cross-platform, JetBrains, hosted survival, and comparative superiority external/partial.
- [ ] Generate `feature-audit-3.0.0.json`, completeness audit, and remaining gaps.
- [ ] Update every version surface to 3.0.0 and preserve all historical limitation contracts.
- [ ] Re-run every historical measurement on the 3.0 tree.
- [ ] Run version coherence and all frontier verifiers.
- [ ] Commit `chore(release): prepare Forge Studio 3.0.0`.

### Task 12: Full release, packaging, and export

**Files:**
- Generated release artifacts under `release/` and exported copies under `/mnt/data`.
- Update: `/mnt/data/project-manifest.json`.

**Interfaces:**
- Produces source, Windows, update payload, VSIX, NolaneNative pack, release evidence, change set, matrix, audit, measurements, manifests, and checksums.

- [ ] Run full `npm test` on the clean release commit.
- [ ] Run the complete release matrix or canonical non-overlapping groups on the same commit and merge receipts.
- [ ] Build release evidence and change-set archives with internal manifests and SHA-256.
- [ ] Copy only 3.0 files created or changed in this response to `/mnt/data` and update workspace manifest.
- [ ] Verify checksums, open every ZIP/VSIX, confirm matrix/audit/source identity/evidence log count/change-set lineage/composition budget/Git cleanliness.
- [ ] Keep the feature branch/worktree when no remote or base integration target is provided.
