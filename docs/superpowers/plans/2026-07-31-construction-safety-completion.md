# Construction Safety Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and certify Forge Studio 3.4.0 with 21 local construction, patch-safety, verification, causal, and counterfactual gaps fully verified.

**Architecture:** Add four isolated runtimes that compose existing construction, verification, repository truth, and world-model primitives. Integrate them lazily through the existing control planes, generate deterministic measurement evidence, promote exactly 21 audit IDs, and add required release gate 73.

**Tech Stack:** Node.js ESM, built-in `node:test`, Git worktrees, ForgeOS canonical JSON/SHA-256 receipts, existing SQLite StudioStore adapters.

## Global Constraints

- Do not change any of the 63 external-gate statuses.
- Do not claim comparative superiority or perfect semantic understanding.
- All candidate worktrees use one immutable verification contract.
- All execute transitions require observed verification receipts.
- All new production behavior follows RED -> GREEN tests.

---

### Task 1: Construction Contract Runtime

**Files:**
- Create: `src/construction/construction-contract-runtime.mjs`
- Test: `tests/construction-contract-runtime.test.mjs`

**Interfaces:**
- Produces: `compileContract(input)`, `createVerticalPlan(input)`, `replan(input)`, `launchCandidates(input)`, `restore(input)`.

- [ ] Write failing tests for contract-first records, checkpointed vertical slices, task revocation, bounded ownership, 2-3 real worktrees, and exact capsule restore.
- [ ] Run `node --test tests/construction-contract-runtime.test.mjs` and confirm missing-module failure.
- [ ] Implement the minimal runtime using Git subprocesses and existing `StateCapsuleStore`.
- [ ] Run the test and confirm all assertions pass.
- [ ] Commit the runtime and test.

### Task 2: Semantic Change Safety Runtime

**Files:**
- Create: `src/construction/semantic-change-safety-runtime.mjs`
- Test: `tests/semantic-change-safety-runtime.test.mjs`

**Interfaces:**
- Produces: `diffApi(input)`, `blastRadius(input)`, `detectExistingAbstraction(input)`, `migrationImpact(input)`, `compareCandidates(input)`, `reviewGate(input)`.

- [ ] Write failing tests for semantic API dimensions, cited blast radius, duplicate detection, migration rollback, isolated candidate comparison, and mandatory independent review.
- [ ] Run the test and confirm missing-module failure.
- [ ] Implement minimal deterministic behavior with fail-closed evidence validation.
- [ ] Run the test and confirm all assertions pass.
- [ ] Commit the runtime and test.

### Task 3: Independent Verification Runtime

**Files:**
- Create: `src/verification/independent-verification-runtime.mjs`
- Test: `tests/independent-verification-runtime.test.mjs`

**Interfaces:**
- Produces: `runMutationProbe(input)`, `requireIndependentReview(input)`, `verifyJourney(input)`, `registerHiddenCase(input)`, `evaluateHiddenCase(input)`.

- [ ] Write failing tests for temporary mutation restoration, reviewer separation, browser/API artifact receipts, and executor-blind hidden cases.
- [ ] Run the test and confirm missing-module failure.
- [ ] Implement bounded mutation, review, journey, and encrypted hidden-case behavior.
- [ ] Run the test and confirm all assertions pass.
- [ ] Commit the runtime and test.

### Task 4: Causal and Counterfactual Runtime

**Files:**
- Create: `src/cognition/causal-intervention-lab.mjs`
- Create: `src/world-model/counterfactual-change-runtime.mjs`
- Test: `tests/causal-counterfactual-runtime.test.mjs`

**Interfaces:**
- Produces: `CausalInterventionLab.run(input)` and `CounterfactualChangeRuntime.imagine/verify/execute/recordOutcome`.

- [ ] Write failing tests for single-variable interventions, held-constant checks, effect simulation, strict phase order, observed receipt gate, and measured decision gain/loss.
- [ ] Run the test and confirm missing-module failure.
- [ ] Implement minimal content-addressed runtimes.
- [ ] Run the test and confirm all assertions pass.
- [ ] Commit the runtimes and test.

### Task 5: Lazy Integration

**Files:**
- Modify: `src/construction/construction-control-plane.mjs`
- Modify: `src/verification/verification-control-plane.mjs`
- Modify: `src/runtime/world-development-plane.mjs`
- Test: `tests/construction-safety-completion-integration.test.mjs`

- [ ] Write failing integration tests proving lazy initialization and cross-runtime evidence flow.
- [ ] Run the integration test and confirm missing API failures.
- [ ] Add lazy getters and forwarding methods without modifying `src/app.mjs`.
- [ ] Run integration and relevant regression tests.
- [ ] Commit integration changes.

### Task 6: Release Evidence and Audit Promotion

**Files:**
- Create: `scripts/measure-construction-safety-completion.mjs`
- Create: `src/release/construction-safety-completion-verifier.mjs`
- Create: `scripts/verify-construction-safety-completion.mjs`
- Create: `tests/construction-safety-completion-release-gate.test.mjs`
- Modify: `scripts/generate-frontier-feature-audit.mjs`
- Modify: `src/release/frontier-audit-counts.mjs`
- Modify: `src/release/full-release-matrix.mjs`

- [ ] Write failing release-gate tests for deterministic measurement, exact 21-ID promotion, unchanged external gates, and matrix gate 73.
- [ ] Implement measurement and verifier.
- [ ] Update audit generator/counts/matrix.
- [ ] Generate 3.4.0 measurement, audit, gaps, limitations, release, and verification report.
- [ ] Run release-gate tests and commit.

### Task 7: Version, Full Verification, and Packaging

**Files:**
- Modify all release identity/version references through project release tooling.
- Regenerate `project-manifest.json` and inherited measurements for 3.4.0.

- [ ] Update version identity to 3.4.0 with repository scripts.
- [ ] Run focused regression gates.
- [ ] Run full `npm test` with `TERM=xterm`.
- [ ] Commit the release tree.
- [ ] Run the full 73-gate matrix on the clean commit.
- [ ] Package source, Windows x64, update payload, VSIX, change-set, evidence, manifests, and checksums.
- [ ] Verify all archives and public SHA-256 values.
