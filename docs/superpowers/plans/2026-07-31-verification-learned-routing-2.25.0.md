# Verification & Learned Routing 2.25.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add risk-adaptive verification, independent adversarial review, test/API integrity gates, bounded failure injection, trajectory confidence calibration, and verified-outcome routing without weakening existing hard constraints.

**Architecture:** Add focused services under `src/verification/` and `src/providers/`, then expose them through one lazy `VerificationControlPlane` owned by `DecisionPlane`. Reuse `VerificationRunner`, `IndependentReviewService`, `ConstructionControlPlane`, criterion receipts, harness canary, and outcome metrics. No new top-level database or direct import in `src/app.mjs` is permitted.

**Tech Stack:** Node.js ESM, `node:test`, `node:sqlite`, canonical SHA-256 receipts, existing Forge Studio release tooling.

## Global Constraints

- No chain-of-thought, raw prompt, raw model output, secrets, environment dumps, or authorization headers may be persisted.
- Provider/harness learning must remain shadow-only in 2.25.0.
- Hard provider constraints and sandbox/policy gates cannot be relaxed by learning.
- Simple low-risk tasks keep the current fast path.
- `src/app.mjs` must stay at or below 160 static imports and 180 constructor expressions.
- Every completion claim requires criterion-bound verification evidence.

---

### Task 1: Risk-Adaptive Verification Pyramid

**Files:**
- Create: `src/verification/verification-pyramid-planner.mjs`
- Create: `tests/verification-pyramid-planner.test.mjs`
- Modify: `src/construction/test-impact-selector.mjs`

**Interfaces:**
- Consumes: `selectVerificationStages(input)` and semantic findings from `ConstructionControlPlane.analyzePatch()`.
- Produces: `VerificationPyramidPlanner.plan(input) -> signed forge.verification-pyramid-plan.v1`.

- [ ] **Step 1: Write the failing test**

Create tests proving a low-risk internal patch selects syntax/type plus targeted tests, while a public API/auth hot-path patch additionally requires contract, integration, security, performance, independent review, and full-suite stages. Assert every stage and omission has a reason.

- [ ] **Step 2: Run test to verify RED**

Run: `node --test tests/verification-pyramid-planner.test.mjs`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement minimal planner**

Implement deterministic stage selection with ordered stages, `required`, `reason`, `criterionIds`, and `evidenceKinds`. The planner must not execute commands.

- [ ] **Step 4: Run GREEN and regression**

Run: `node --test tests/verification-pyramid-planner.test.mjs tests/test-impact-selector.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

`git add src/verification/verification-pyramid-planner.mjs src/construction/test-impact-selector.mjs tests/verification-pyramid-planner.test.mjs && git commit -m "feat: add risk-adaptive verification pyramid"`

### Task 2: Test Integrity Guard

**Files:**
- Create: `src/verification/test-integrity-guard.mjs`
- Create: `tests/test-integrity-guard.test.mjs`

**Interfaces:**
- Consumes: `{ diff, testRuns, mutationReceipt, sourceHash }`.
- Produces: `TestIntegrityGuard.assess(input) -> forge.test-integrity-assessment.v1`.

- [ ] **Step 1: Write failing tests**

Cover deleted tests, `.skip`, `.only`, weakened strict assertions, removed negative cases, broad module replacement mocks, single-pass flaky evidence, and an unchanged strong test diff.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/test-integrity-guard.test.mjs`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement bounded diff analysis**

Return findings with severity, confidence, path, line, category, evidence, and `blocking`. Require two consistent passes or a non-flaky receipt before a flaky test can prove a criterion.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/test-integrity-guard.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

`git add src/verification/test-integrity-guard.mjs tests/test-integrity-guard.test.mjs && git commit -m "feat: guard test integrity"`

### Task 3: API Existence Gate

**Files:**
- Create: `src/verification/api-existence-gate.mjs`
- Create: `tests/api-existence-gate.test.mjs`

**Interfaces:**
- Consumes: requested API contracts plus exact manifest, lockfile, AST/LSP, and capability evidence.
- Produces: `ApiExistenceGate.verify(input) -> forge.api-existence-decision.v1`.

- [ ] **Step 1: Write failing tests**

Cover an existing compatible symbol, missing package, version mismatch, signature mismatch, deprecated API without exception, and unsupported platform.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/api-existence-gate.test.mjs`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement exact-evidence checks**

Unknown evidence must produce `status: unknown` and block required API use. Include evidence receipts and never infer existence from model memory.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/api-existence-gate.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

`git add src/verification/api-existence-gate.mjs tests/api-existence-gate.test.mjs && git commit -m "feat: verify API existence before patching"`

### Task 4: Independent Adversarial Review Coordinator

**Files:**
- Create: `src/verification/adversarial-review-coordinator.mjs`
- Create: `tests/adversarial-review-coordinator.test.mjs`
- Modify: `src/review/independent-review-service.mjs`

**Interfaces:**
- Consumes: executor identity, reviewer candidates, requirement/evidence/diff/test receipts/residual risks.
- Produces: `AdversarialReviewCoordinator.review(input) -> forge.adversarial-review-decision.v1`.

- [ ] **Step 1: Write failing tests**

Prove reviewer identity differs by provider/model or fallback harness profile, reviewer payload omits executor rationale/raw prompt/output, and high/critical disagreement blocks completion until a repair or rebuttal receipt is supplied.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/adversarial-review-coordinator.test.mjs`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement coordinator and bounded review request v2**

Extend the review service with an optional structured context object while preserving legacy diff/rules callers. Persist only fingerprints and bounded public evidence.

- [ ] **Step 4: Verify GREEN and existing review tests**

Run: `node --test tests/adversarial-review-coordinator.test.mjs tests/independent-review-service.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

`git add src/verification/adversarial-review-coordinator.mjs src/review/independent-review-service.mjs tests/adversarial-review-coordinator.test.mjs && git commit -m "feat: coordinate independent adversarial review"`

### Task 5: Failure Injection & Recovery Proof

**Files:**
- Create: `src/verification/failure-injection-lab.mjs`
- Create: `tests/failure-injection-lab.test.mjs`

**Interfaces:**
- Consumes: explicit fault adapter, checkpoint adapter, recovery adapter, verification callback.
- Produces: `FailureInjectionLab.run(input) -> forge.failure-injection-proof.v1`.

- [ ] **Step 1: Write failing tests**

Cover network loss, process death, database lock, stale-file race, and memory pressure. Assert bounded lease, no irreversible action while uncertain, resume from last valid checkpoint, and criterion re-verification.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/failure-injection-lab.test.mjs`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement adapter-driven lab**

No direct OS fault injection is allowed. The lab orchestrates supplied deterministic adapters and hashes all expected/actual/recovery evidence.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/failure-injection-lab.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

`git add src/verification/failure-injection-lab.mjs tests/failure-injection-lab.test.mjs && git commit -m "feat: prove bounded failure recovery"`

### Task 6: Trajectory Confidence Calibrator

**Files:**
- Create: `src/verification/trajectory-confidence-calibrator.mjs`
- Create: `tests/trajectory-confidence-calibrator.test.mjs`

**Interfaces:**
- Consumes: per-stage confidence, domain/task labels, independent receipts, verified outcomes.
- Produces: calibrated snapshot and weakest-link completion confidence.

- [ ] **Step 1: Write failing tests**

Prove final confidence is bounded by the weakest critical stage, independent verification can raise confidence within limits, and verified outcomes update domain/task calibration error while unverified claims do not.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/trajectory-confidence-calibrator.test.mjs`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement bounded calibration bins**

Use deterministic fixed-width bins, bounded history, Brier-style error, and signed receipts. Do not use self-reported capability as truth.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/trajectory-confidence-calibrator.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

`git add src/verification/trajectory-confidence-calibrator.mjs tests/trajectory-confidence-calibrator.test.mjs && git commit -m "feat: calibrate trajectory confidence"`

### Task 7: Verified-Outcome Contextual Bandit

**Files:**
- Create: `src/providers/verified-outcome-bandit.mjs`
- Create: `tests/verified-outcome-bandit.test.mjs`
- Modify: `src/providers/outcome-aware-router.mjs`
- Modify: `src/providers/provider-outcome-feedback-service.mjs`

**Interfaces:**
- Consumes: provider+harness pair, task feature vector, verified reward receipt, resource metrics.
- Produces: shadow ranking, policy lineage, promote/disable/rollback decisions.

- [ ] **Step 1: Write failing tests**

Cover hard-constraint preservation, no learning without verification receipt, provider+harness pair ranking, latency/RSS/correction penalties, deterministic shadow cohorts, exact rollback, and Accept-click-only rejection.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/verified-outcome-bandit.test.mjs`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement lightweight posterior and lineage**

Use bounded per-feature buckets and deterministic sampling; 2.25 returns shadow recommendations only. Existing static router remains traffic authority.

- [ ] **Step 4: Verify GREEN and router regressions**

Run: `node --test tests/verified-outcome-bandit.test.mjs tests/outcome-aware-router.test.mjs tests/provider-outcome-feedback-service.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

`git add src/providers/verified-outcome-bandit.mjs src/providers/outcome-aware-router.mjs src/providers/provider-outcome-feedback-service.mjs tests/verified-outcome-bandit.test.mjs && git commit -m "feat: add verified-outcome shadow bandit"`

### Task 8: Verification Control Plane & Completion Gate

**Files:**
- Create: `src/verification/semantic-completion-gate.mjs`
- Create: `src/verification/verification-control-plane.mjs`
- Create: `tests/verification-control-plane.test.mjs`
- Modify: `src/decision/decision-plane.mjs`
- Modify: `src/orchestration/verification-runner.mjs`
- Modify: `src/construction/completion-proof-bundle.mjs`

**Interfaces:**
- Consumes: Tasks 1–7 services and existing construction/cognition receipts.
- Produces: lazy facade methods and `forge.semantic-completion-decision.v1`.

- [ ] **Step 1: Write failing integration tests**

Prove low-risk fast path does not instantiate the plane, high-risk verification produces criterion-bound evidence, test/API/review blockers prevent completion, and proof bundles include confidence, residual risks, and rollback point without private fields.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/verification-control-plane.test.mjs`
Expected: FAIL with module-not-found or missing DecisionPlane methods.

- [ ] **Step 3: Implement lazy facade and runner bindings**

Add `DecisionPlane.planVerification`, `assessTestIntegrity`, `verifyApiExistence`, `runAdversarialReview`, `runFailureInjection`, `calibrateTrajectory`, `recordBanditOutcome`, and `decideSemanticCompletion`. Extend `VerificationRunner` to accept a precomputed pyramid plan without breaking existing matrix behavior.

- [ ] **Step 4: Verify GREEN and broad regressions**

Run: `node --test tests/verification-control-plane.test.mjs tests/verification-runner.test.mjs tests/decision-plane.test.mjs tests/long-horizon-construction-release-gate.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

`git add src/verification src/decision/decision-plane.mjs src/orchestration/verification-runner.mjs src/construction/completion-proof-bundle.mjs tests/verification-control-plane.test.mjs && git commit -m "feat: integrate verification control plane"`

### Task 9: Release Gate, Measurement, Audit, and Version 2.25.0

**Files:**
- Create: `src/release/verification-learned-routing-verifier.mjs`
- Create: `scripts/measure-verification-learned-routing.mjs`
- Create: `scripts/verify-verification-learned-routing.mjs`
- Create: `tests/verification-learned-routing-release-gate.test.mjs`
- Modify: `src/release/full-release-matrix.mjs`
- Modify: version surfaces, release docs, frontier audit generator, manifest, and checksum tooling.

**Interfaces:**
- Consumes: deterministic fixture covering Tasks 1–8.
- Produces: 2.25 measurement, audit transition, release gate, matrix entry, artifacts, and non-claims.

- [ ] **Step 1: Write failing release-gate test**

Require measurement proof for risk-adaptive stage selection, test/API blocking, independent review disagreement, recovered injected fault, weakest-link confidence, shadow-only bandit, privacy, and version-aware 1,150-item audit.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/verification-learned-routing-release-gate.test.mjs`
Expected: FAIL because verifier/measurement/version 2.25 do not exist.

- [ ] **Step 3: Implement measurement and release verifier**

Generate deterministic local evidence; state that production multi-provider reviewer independence, hidden hosted regression sets, long-term patch survival, and broad platform fault certification remain unproven.

- [ ] **Step 4: Update version and release surfaces**

Set all product/package/extension/release identities to `2.25.0`, add the new required matrix gate, regenerate all inherited measurements on the 2.25 tree, and update the frontier audit without rewriting historical release counts.

- [ ] **Step 5: Run focused and full verification**

Run focused tests and all architecture gates, then `npm test`, then the full release matrix. All must pass on one clean commit.

- [ ] **Step 6: Package and verify artifacts**

Create source, Windows x64, update payload, VSIX, NolaneNative pack, release evidence, change-set, manifests, and SHA-256 files. Verify every archive and published checksum.

- [ ] **Step 7: Commit release**

Commit the clean 2.25.0 tree and preserve branch/worktree unless a remote integration target is explicitly provided.
