# Forge Studio 2.24.0 Long-Horizon Construction Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an evidence-backed construction control plane that compiles specifications, traces requirements, enforces invariants, executes plans as state machines, resumes from capsules, analyzes semantic patch impact, compares isolated candidates, and produces completion proof bundles.

**Architecture:** Add focused modules under `src/construction/` and expose them only through a lazy `ConstructionControlPlane` owned by the existing `DecisionPlane`. Existing Mission Planner, patch transaction service, checkpoint/worktree services, and verification receipts remain the mutation/execution authorities. The new plane verifies and authorizes; it never edits files or merges branches directly.

**Tech Stack:** Node.js ESM, `node:test`, existing ForgeOS canonical JSON SHA-256 receipts, existing Mission/Decision/Cognition services, local filesystem/Git adapters, no new runtime dependency.

## Global Constraints

- Preserve `src/app.mjs` at or below 160 static imports and 180 constructor expressions.
- No raw prompt, model output, chain-of-thought, secret, environment dump, or raw command in persistent receipts.
- No production file mutation inside `src/construction/`.
- Every state-changing operation returns an immutable content-addressed receipt.
- Invalid state transitions, stale source hashes, missing verification, or hard-constraint conflicts fail closed.
- Simple agent tasks must not load the Construction Control Plane.
- Historical audits for 2.20–2.23 must preserve their original counts.
- Production model planning quality, hosted CI, cross-device recovery, and benchmark superiority remain explicit non-claims unless independently evidenced.

---

### Task 1: Construction Utilities and Specification Compiler

**Files:**
- Create: `src/construction/construction-utils.mjs`
- Create: `src/construction/specification-compiler.mjs`
- Test: `tests/specification-compiler.test.mjs`

**Interfaces:**
- Produces: `compileSpecification(input): SpecificationReceipt`
- Produces: `SpecificationConflictError` for malformed or contradictory hard requirements.
- `SpecificationReceipt` contains `schema`, `specificationId`, `goal`, `criteria`, `nonGoals`, `constraints`, `interfaces`, `invariants`, `affectedComponents`, `verificationPlan`, `conflicts`, `status`, `receiptSha256`.

- [ ] **Step 1: Write the failing specification tests**

Create tests proving:

```js
const compiled = compileSpecification({
  specificationId: 'spec-session',
  goal: 'Add session expiration',
  criteria: [{ criterionId: 'c1', statement: 'Expired sessions are rejected', weight: 4 }],
  nonGoals: ['Rewrite authentication'],
  constraints: [
    { constraintId: 'api-stable', kind: 'hard', statement: 'Public API must remain compatible' },
  ],
  interfaces: [{ interfaceId: 'validate-session', path: 'src/session.mjs', compatibility: 'preserve' }],
  invariants: [{ invariantId: 'no-token-log', severity: 'critical', statement: 'Tokens are never logged' }],
  verificationPlan: [{ verificationId: 'test-expiration', criterionIds: ['c1'], kind: 'test' }],
});
assert.equal(compiled.status, 'ready');
assert.ok(Object.isFrozen(compiled));
assert.equal(compiled.criteria[0].weight, 4);
```

Also prove a hard conflict such as “public API must remain unchanged” plus “rename public API without compatibility adapter” returns `status: 'blocked'`, with a conflict receipt and no edit authorization.

- [ ] **Step 2: Run RED**

Run: `node --test tests/specification-compiler.test.mjs`
Expected: FAIL because `src/construction/specification-compiler.mjs` does not exist.

- [ ] **Step 3: Implement deterministic compilation**

Implement bounded validators, duplicate-ID rejection, hard/soft constraint normalization, contradiction detection, immutable output, and canonical SHA-256 receipts. Do not call a provider or mutate files.

- [ ] **Step 4: Run GREEN**

Run: `node --test tests/specification-compiler.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/construction/construction-utils.mjs src/construction/specification-compiler.mjs tests/specification-compiler.test.mjs
git commit -m "feat: compile bounded construction specifications"
```

### Task 2: Requirement Traceability Ledger

**Files:**
- Create: `src/construction/requirement-traceability-ledger.mjs`
- Test: `tests/requirement-traceability-ledger.test.mjs`

**Interfaces:**
- Consumes: specification criteria from Task 1.
- Produces: `RequirementTraceabilityLedger.registerSpecification(specification)`
- Produces: `link({ fromType, fromId, relation, toType, toId, sourceHash, receiptId })`
- Produces: `criterionCompletion(criterionId)` and `snapshot()`.

- [ ] **Step 1: Write failing traceability tests**

Prove that a criterion remains incomplete until it has a valid path:

```text
criterion → decision → plan-step → symbol → test → passed-verification-receipt
```

Reject unknown nodes, duplicate contradictory links, stale source hashes, and failed verification receipts.

- [ ] **Step 2: Run RED**

Run: `node --test tests/requirement-traceability-ledger.test.mjs`
Expected: FAIL because the ledger module does not exist.

- [ ] **Step 3: Implement typed graph storage**

Use bounded maps/arrays, stable IDs, immutable projections, and canonical receipts. Criterion completion must require every verification ID declared in the specification compiler output.

- [ ] **Step 4: Run GREEN**

Run: `node --test tests/requirement-traceability-ledger.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/construction/requirement-traceability-ledger.mjs tests/requirement-traceability-ledger.test.mjs
git commit -m "feat: add requirement traceability ledger"
```

### Task 3: Invariant Ledger and Verification Gate

**Files:**
- Create: `src/construction/invariant-ledger.mjs`
- Test: `tests/invariant-ledger.test.mjs`

**Interfaces:**
- Consumes: invariants from Task 1.
- Produces: `register(invariant)`, `recordVerification(invariantId, receipt)`, `authorize(scope)`, `snapshot()`.
- `authorize(scope)` returns `{ allowed, blockingInvariantIds, receiptSha256 }`.

- [ ] **Step 1: Write failing invariant tests**

Prove critical failed invariants block authorization, warning invariants report without blocking, stale source hashes invalidate previous passes, and an invariant cannot be silently removed while active.

- [ ] **Step 2: Run RED**

Run: `node --test tests/invariant-ledger.test.mjs`
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement versioned invariant lifecycle**

Store owner, severity, verifier ID, protected scopes, source hash, state, revision, and receipt. Only an explicit supersede receipt may replace an invariant.

- [ ] **Step 4: Run GREEN**

Run: `node --test tests/invariant-ledger.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/construction/invariant-ledger.mjs tests/invariant-ledger.test.mjs
git commit -m "feat: enforce construction invariants"
```

### Task 4: Executable Plan State Machine

**Files:**
- Create: `src/construction/executable-plan-engine.mjs`
- Test: `tests/executable-plan-engine.test.mjs`

**Interfaces:**
- Consumes: specification ID, criteria IDs, invariant IDs, and mission hierarchy.
- Produces: `createPlan(input)`, `transition(planId, stepId, event)`, `readySteps(planId)`, `revalidate(planId, evidence)`, `snapshot(planId)`.

- [ ] **Step 1: Write failing state-machine tests**

Prove:

- dependencies move a step from `pending` to `ready`;
- only allowed transitions occur;
- `running → completed` without `verifying` and a passed receipt is rejected;
- allowed files and forbidden changes are normalized;
- repository fingerprint or assumption mismatch marks steps `blocked` or `superseded`;
- retry/correction budgets are bounded.

- [ ] **Step 2: Run RED**

Run: `node --test tests/executable-plan-engine.test.mjs`
Expected: FAIL because the plan engine does not exist.

- [ ] **Step 3: Implement the state machine**

Define exact states, transition table, dependency resolution, precondition checks, expected state/effect recording, fallback selection, stop conditions, and immutable receipts.

- [ ] **Step 4: Run GREEN**

Run: `node --test tests/executable-plan-engine.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/construction/executable-plan-engine.mjs tests/executable-plan-engine.test.mjs
git commit -m "feat: add executable construction plan engine"
```

### Task 5: State Capsule Store and Prospective Obligations

**Files:**
- Create: `src/construction/state-capsule-store.mjs`
- Create: `src/construction/prospective-obligation-ledger.mjs`
- Test: `tests/state-capsule-store.test.mjs`
- Test: `tests/prospective-obligation-ledger.test.mjs`

**Interfaces:**
- Produces: `StateCapsuleStore.save(capsule)`, `load(capsuleId)`, `resume(capsuleId, currentState)`.
- Produces: `ProspectiveObligationLedger.register(obligation)`, `observe(event)`, `complete(obligationId, receipt)`.

- [ ] **Step 1: Write failing capsule and obligation tests**

Use a temporary directory to prove a capsule survives a new store instance, validates SHA-256, resumes only when repository/plan/invariant fingerprints match, and rejects corruption. Prove an obligation cannot complete before its trigger and verification receipt.

- [ ] **Step 2: Run RED**

Run: `node --test tests/state-capsule-store.test.mjs tests/prospective-obligation-ledger.test.mjs`
Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement bounded persistence**

Persist canonical JSON atomically with temp-file rename. Store no raw prompts or commands. Limit capsule size, history, obligations, and event previews.

- [ ] **Step 4: Run GREEN**

Run: `node --test tests/state-capsule-store.test.mjs tests/prospective-obligation-ledger.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/construction/state-capsule-store.mjs src/construction/prospective-obligation-ledger.mjs tests/state-capsule-store.test.mjs tests/prospective-obligation-ledger.test.mjs
git commit -m "feat: persist resumable construction state"
```

### Task 6: Goal Conflict Resolver

**Files:**
- Create: `src/construction/goal-conflict-resolver.mjs`
- Test: `tests/goal-conflict-resolver.test.mjs`

**Interfaces:**
- Produces: `resolve({ hardConstraints, negotiableGoals, options })`.
- Returns selected option, rejected options with reasons, unresolved conflicts, and receipt.

- [ ] **Step 1: Write failing goal-conflict tests**

Prove options violating a hard constraint are rejected regardless of score, trade-offs are ranked only among compliant options, and no result may silently weaken acceptance criteria.

- [ ] **Step 2: Run RED**

Run: `node --test tests/goal-conflict-resolver.test.mjs`
Expected: FAIL because the resolver does not exist.

- [ ] **Step 3: Implement deterministic resolution**

Use explicit user/contract priority, bounded numeric trade-off scores, stable tie-breaking, and immutable receipts.

- [ ] **Step 4: Run GREEN**

Run: `node --test tests/goal-conflict-resolver.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/construction/goal-conflict-resolver.mjs tests/goal-conflict-resolver.test.mjs
git commit -m "feat: resolve construction goal conflicts"
```

### Task 7: Semantic Patch Analyzer and Dynamic Budget

**Files:**
- Create: `src/construction/semantic-patch-analyzer.mjs`
- Create: `src/construction/dynamic-patch-budget.mjs`
- Test: `tests/semantic-patch-analyzer.test.mjs`
- Test: `tests/dynamic-patch-budget.test.mjs`
- Modify: `src/execution/atomic-patch-transaction-service.mjs`
- Modify: `tests/atomic-patch-transaction-service.test.mjs`

**Interfaces:**
- Produces: `analyzeSemanticPatch(input): SemanticPatchReport`.
- Produces: `derivePatchBudget({ taskKind, risk, specification }): PatchBudget`.
- Atomic patch service accepts optional `semanticAuthorization` and rejects blocked reports before writing.

- [ ] **Step 1: Write failing semantic-impact tests**

Prove a 5-line public API break scores above a 30-line internal compatible change; generated/test weakening/security permission changes receive explicit findings; reverted lines and correction lineage count toward edit cost.

- [ ] **Step 2: Write failing dynamic-budget and integration tests**

Prove a small bugfix defaults to 2 files/80 lines, a feature gets a larger bounded budget, and unrelated refactor causes atomic patch authorization to fail before filesystem mutation.

- [ ] **Step 3: Run RED**

Run: `node --test tests/semantic-patch-analyzer.test.mjs tests/dynamic-patch-budget.test.mjs tests/atomic-patch-transaction-service.test.mjs`
Expected: FAIL because analyzers and semantic authorization do not exist.

- [ ] **Step 4: Implement analysis and patch-service gate**

Use provided AST/LSP/digital-twin evidence when available; otherwise mark relations unknown rather than guessing. Keep existing textual checks intact. Add one fail-closed semantic authorization hook before transaction prepare/apply.

- [ ] **Step 5: Run GREEN**

Run: `node --test tests/semantic-patch-analyzer.test.mjs tests/dynamic-patch-budget.test.mjs tests/atomic-patch-transaction-service.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/construction/semantic-patch-analyzer.mjs src/construction/dynamic-patch-budget.mjs src/execution/atomic-patch-transaction-service.mjs tests/semantic-patch-analyzer.test.mjs tests/dynamic-patch-budget.test.mjs tests/atomic-patch-transaction-service.test.mjs
git commit -m "feat: gate patches by semantic impact"
```

### Task 8: Test Impact Selector

**Files:**
- Create: `src/construction/test-impact-selector.mjs`
- Test: `tests/test-impact-selector.test.mjs`

**Interfaces:**
- Produces: `selectVerificationStages({ changedSymbols, graphEdges, relatedTests, historicalFailures, risk, semanticFindings })`.

- [ ] **Step 1: Write failing impact-selection tests**

Prove direct symbol tests precede module/integration tests, public API/security/schema findings require wider stages, and full suite is not selected for a low-risk isolated internal change unless evidence requires it.

- [ ] **Step 2: Run RED**

Run: `node --test tests/test-impact-selector.test.mjs`
Expected: FAIL because the selector does not exist.

- [ ] **Step 3: Implement staged verification selection**

Return explicit stages, reasons, test IDs/commands as references, and a receipt. Do not execute shell commands.

- [ ] **Step 4: Run GREEN**

Run: `node --test tests/test-impact-selector.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/construction/test-impact-selector.mjs tests/test-impact-selector.test.mjs
git commit -m "feat: select tests from semantic impact"
```

### Task 9: Candidate Patch Selection

**Files:**
- Create: `src/construction/candidate-patch-selector.mjs`
- Test: `tests/candidate-patch-selector.test.mjs`

**Interfaces:**
- Produces: `selectCandidate({ verificationContractSha256, candidates })`.
- Candidate input includes worktree/checkpoint ID, verified criteria, invariant results, semantic footprint, token cost, RSS MB-seconds, edit cost, textual diff size, and receipts.

- [ ] **Step 1: Write failing candidate tests**

Prove an incorrect but cheap candidate loses; among correct candidates, lower semantic footprint wins before resource yield; mismatched verification contracts or non-isolated candidates are rejected.

- [ ] **Step 2: Run RED**

Run: `node --test tests/candidate-patch-selector.test.mjs`
Expected: FAIL because the selector does not exist.

- [ ] **Step 3: Implement deterministic selection**

Validate two or three candidates, correctness gates, shared contract, isolation receipt, stable ordering, and selection receipt.

- [ ] **Step 4: Run GREEN**

Run: `node --test tests/candidate-patch-selector.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/construction/candidate-patch-selector.mjs tests/candidate-patch-selector.test.mjs
git commit -m "feat: compare isolated patch candidates"
```

### Task 10: Completion Proof Bundle

**Files:**
- Create: `src/construction/completion-proof-builder.mjs`
- Test: `tests/completion-proof-builder.test.mjs`

**Interfaces:**
- Consumes: specification, traceability snapshot, invariant snapshot, patch report, verification receipts, risks, and rollback point.
- Produces: `buildCompletionProof(input)` with `status: complete|incomplete` and explicit missing evidence.

- [ ] **Step 1: Write failing proof-bundle tests**

Prove missing criterion, invariant verification, rollback point, or required test receipt yields `incomplete`. Complete evidence yields an immutable bundle with no private fields.

- [ ] **Step 2: Run RED**

Run: `node --test tests/completion-proof-builder.test.mjs`
Expected: FAIL because the builder does not exist.

- [ ] **Step 3: Implement bundle construction**

Include criteria matrix, traceability projection, changed symbols, semantic footprint, decisions, tests, residual risks, limitations, rollback point, and receipt.

- [ ] **Step 4: Run GREEN**

Run: `node --test tests/completion-proof-builder.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/construction/completion-proof-builder.mjs tests/completion-proof-builder.test.mjs
git commit -m "feat: build completion proof bundles"
```

### Task 11: Construction Control Plane and Lazy Decision Integration

**Files:**
- Create: `src/construction/construction-control-plane.mjs`
- Create: `src/construction/index.mjs`
- Modify: `src/decision/decision-plane.mjs`
- Modify: `src/agent/agent-loop.mjs`
- Test: `tests/construction-control-plane.test.mjs`
- Test: `tests/construction-decision-plane-integration.test.mjs`
- Test: `tests/agent-loop-construction-mode.test.mjs`

**Interfaces:**
- Decision Plane adds lazy methods: `compileConstructionSpecification`, `createExecutablePlan`, `recordConstructionTrace`, `verifyConstructionInvariant`, `saveConstructionCapsule`, `resumeConstructionCapsule`, `analyzeConstructionPatch`, `selectConstructionCandidate`, `buildConstructionProof`, `constructionSnapshot`.

- [ ] **Step 1: Write failing facade and lazy-load tests**

Prove a simple task leaves `constructionLoaded: false`; requesting long-horizon mode loads the plane; the facade composes Tasks 1–10; snapshots expose only bounded metadata and claims.

- [ ] **Step 2: Write failing AgentLoop integration test**

Use a long-horizon task with a structured specification. Prove AgentLoop requests compilation/authorization but cannot edit when specification conflicts or invariant authorization fails. Prove the returned cognition/construction projection contains receipt IDs, not private reasoning.

- [ ] **Step 3: Run RED**

Run: `node --test tests/construction-control-plane.test.mjs tests/construction-decision-plane-integration.test.mjs tests/agent-loop-construction-mode.test.mjs`
Expected: FAIL because the facade and Decision Plane methods do not exist.

- [ ] **Step 4: Implement lazy integration**

Create the plane only on first construction operation. Extend Decision Plane lifecycle and close handling. Add the minimum AgentLoop preflight needed to block unsafe long-horizon tasks; do not add direct construction imports to `src/app.mjs`.

- [ ] **Step 5: Run GREEN and regression tests**

Run:

```bash
node --test tests/construction-control-plane.test.mjs tests/construction-decision-plane-integration.test.mjs tests/agent-loop-construction-mode.test.mjs tests/cognitive-decision-plane-integration.test.mjs tests/agent-loop-cognitive-mode.test.mjs tests/decision-plane-app-wiring.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/construction src/decision/decision-plane.mjs src/agent/agent-loop.mjs tests/construction-control-plane.test.mjs tests/construction-decision-plane-integration.test.mjs tests/agent-loop-construction-mode.test.mjs
git commit -m "feat: integrate long-horizon construction plane"
```

### Task 12: 2.24 Release Gate, Audit, Measurement, and Packaging

**Files:**
- Create: `src/release/long-horizon-construction-verifier.mjs`
- Create: `scripts/measure-long-horizon-construction.mjs`
- Create: `scripts/verify-long-horizon-construction.mjs`
- Create: `tests/long-horizon-construction-release-gate.test.mjs`
- Modify: `src/release/full-release-matrix.mjs`
- Modify: `scripts/generate-frontier-feature-audit.mjs`
- Modify: version surfaces listed by `scripts/verify-version-coherence.mjs`
- Create/Modify: `docs/RELEASE-2.24.0.md`
- Create/Modify: `docs/VERIFICATION-REPORT-2.24.0.md`
- Create/Modify: `docs/ADVERSARIAL-WEAKNESS-MATRIX-2.24.0.md`
- Create/Modify: `docs/LIMITATIONS-2.24.0.md`
- Generate: `docs/long-horizon-construction-measurement-2.24.0.json`
- Generate: `docs/feature-audit-2.24.0.json`
- Generate: `docs/FEATURE-COMPLETENESS-AUDIT-2.24.0.md`
- Generate: `docs/REMAINING-GAPS-2.24.0.md`

**Interfaces:**
- New required matrix gate ID: `long-horizon-construction`.
- Measurement demonstrates specification conflict blocking, traceability, invariant gate, plan transitions, capsule resume/revalidation, semantic patch ranking, test impact selection, candidate selection, and completion proof.

- [ ] **Step 1: Write failing release-gate test**

Require verifier source, CLI, measurement, matrix registration, audit transition, version identity, limitations, and direct behavior evidence.

- [ ] **Step 2: Run RED**

Run: `node --test tests/long-horizon-construction-release-gate.test.mjs`
Expected: FAIL because release artifacts do not exist.

- [ ] **Step 3: Implement measurement and verifier**

Use deterministic local fixtures and real filesystem capsule persistence. Clearly label candidate generation and model planning quality as not benchmarked. Fail if private/raw fields are present.

- [ ] **Step 4: Update version-aware audit**

Add exact verified/partial sets for 2.24 while preserving 2.20–2.23 historical counts. Add construction evidence paths and the new release gate only for versions at least 2.24.

- [ ] **Step 5: Update version surfaces and release docs**

Set package/runtime/update/extension/release identity to `2.24.0`; inherit all previous limitation contracts and append 2.24 non-claims.

- [ ] **Step 6: Generate measurement and audit**

Run:

```bash
node scripts/measure-long-horizon-construction.mjs . docs/long-horizon-construction-measurement-2.24.0.json
node scripts/generate-frontier-feature-audit.mjs . 2.24.0
node scripts/generate-manifest.mjs
```

- [ ] **Step 7: Run focused gates**

Run:

```bash
node --test tests/long-horizon-construction-release-gate.test.mjs
node scripts/verify-long-horizon-construction.mjs .
node scripts/verify-cognitive-decision-kernel.mjs .
node scripts/verify-version-coherence.mjs .
```

Expected: PASS.

- [ ] **Step 8: Commit release source**

```bash
git add .
git commit -m "release: certify long-horizon construction engine"
```

- [ ] **Step 9: Run the full Node suite**

Run: `npm test`
Expected: all discovered tests pass exactly once.

- [ ] **Step 10: Run the complete Full Release Matrix**

Run with the verified optional NolaneNative pack root:

```bash
FORGE_STUDIO_NOLANE_NATIVE_PACK_ROOT=<verified-unpacked-pack-root> npm run release:matrix
```

Expected: every required gate passes on a clean commit, including Node, runtime smoke, VS Code, Go, Python, ForgeOS, Windows bootstrap, fresh reconstruction, release artifacts, and archive integrity.

- [ ] **Step 11: Publish artifacts and verify copies**

Create source, Windows, update, VSIX, NolaneNative, evidence, and change-set artifacts; update `project-manifest-2.24.0.json`; create `PUBLISH-SHA256SUMS-2.24.0.txt`; verify checksums and archive integrity on the exact `/mnt/data` copies.
