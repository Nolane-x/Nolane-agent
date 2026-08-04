# Forge Studio 2.25.0 Verification & Learned Routing Design

## Goal

Build a risk-adaptive verification and review control plane that prevents false-green completion, verifies API use before patch authorization, proves bounded recovery under injected failures, calibrates confidence across the whole trajectory, and learns provider/harness routing only from verified outcomes.

## Scope

This release covers frontier requirements 37.1–37.18, 38.1–38.13, 38.15–38.17, and 47.3–47.6 where they can be demonstrated locally with deterministic adapters. Patch-survival learning after 7–30 days, production traffic canaries, hidden hosted regression infrastructure, and cross-provider production certification remain partial or external gates.

## Architectural choice

Use one lazy `VerificationControlPlane` behind the existing `DecisionPlane`, `ConstructionControlPlane`, `VerificationRunner`, and provider routing stack. Reuse existing semantic patch analysis, test-impact selection, criterion receipts, independent review storage, harness canary, resource measurements, and outcome feedback. Do not create another mission engine, router, review database, or release framework.

## Components

### 1. Risk-Adaptive Verification Pyramid

`VerificationPyramidPlanner` consumes semantic patch findings, changed symbols, hard constraints, runtime surfaces, historical failures, and risk. It emits ordered stages from parse/type through targeted, contract, integration, browser/API journey, mutation probe, performance, security, independent review, and full suite. Every selected or omitted stage carries a reason. High-risk omissions are invalid.

The planner must not execute commands. `VerificationRunner` remains the executor and binds each result to criterion receipts.

### 2. Test Integrity Guard

`TestIntegrityGuard` analyzes test diffs and receipts for deleted tests, skip/only markers, weakened assertions, removed negative cases, broad mocks that replace the system under test, and single-pass flaky evidence. It produces blocking findings for high-confidence integrity regressions and requires repeated evidence for flaky tests.

The guard must not infer semantics from arbitrary prose. It reports uncertainty when a pattern is ambiguous.

### 3. API Existence Gate

`ApiExistenceGate` checks requested symbols, packages, versions, import paths, signatures, deprecation, and platform support against exact evidence supplied by lockfiles, manifests, LSP/AST records, or runtime capability probes. Unknown evidence is not converted to success. Patch authorization fails when a required API is absent, incompatible, deprecated without an approved exception, or unsupported on the target platform.

### 4. Independent Adversarial Review

`AdversarialReviewCoordinator` selects a reviewer identity that differs from the executor in provider/model or, when only one provider exists, differs in harness profile and review role. The reviewer receives only requirements, evidence cards, diff, test receipts, semantic findings, and residual risks. Executor rationale, raw prompt, model output, and chain-of-thought are forbidden.

High/critical disagreements must be resolved by a repair receipt, accepted exception, or verified rebuttal before completion.

### 5. Failure Injection & Recovery Proof

`FailureInjectionLab` runs deterministic adapters for network loss, process death, database lock, stale-file race, and memory pressure. It records checkpoint, injected fault, expected degradation, actual behavior, recovery action, and final verification. Faults are bounded and reversible; the lab does not modify production infrastructure directly.

A recovery proof passes only when state resumes from the last valid checkpoint, no irreversible action occurs during uncertainty, and the original acceptance criterion is re-verified.

### 6. Trajectory Confidence Calibration

`TrajectoryConfidenceCalibrator` tracks confidence separately for requirement understanding, retrieval, root cause, plan, tool execution, patch, and verification. Final confidence is bounded by the weakest critical link and can only be increased by independent verification evidence. It maintains domain/task calibration bins from verified outcomes and records overconfidence/underconfidence error.

### 7. Verified-Outcome Contextual Bandit

`VerifiedOutcomeBandit` ranks provider+harness pairs under existing hard constraints. Features include task type, language, repository size, risk, changed symbols, context budget, available tools, latency, peak RSS, rssMbSeconds, corrections, first-patch result, and human intervention.

Policy updates require verification receipts. New policies start in shadow mode, retain lineage/version/SHA-256, use deterministic cohorts, and can be disabled or rolled back. The 2.25 release does not autonomously route production traffic with an unverified candidate.

### 8. Completion Gate & Proof

`SemanticCompletionGate` combines criterion receipts, verification pyramid results, test-integrity findings, API-existence evidence, independent review disagreements, journey/security/performance requirements, confidence calibration, and residual risks. It emits a machine-readable completion decision and extends the existing completion proof bundle. A green test suite alone is insufficient.

## Data flow

1. Construction analysis emits semantic footprint and impacted symbols.
2. Verification plane plans required stages and API checks.
3. VerificationRunner executes selected commands and records criterion receipts.
4. Test integrity and independent review inspect the diff and evidence, not executor rationale.
5. Failure lab is invoked only when the task risk or contract requires resilience proof.
6. Calibrator computes trajectory confidence from stage evidence.
7. Completion gate decides pass/block/incomplete.
8. Verified outcomes are recorded to the bandit in shadow mode.

## Privacy and safety

- No chain-of-thought, raw prompts, model output, environment dumps, secrets, or authorization headers are stored.
- Review requests use bounded evidence and diff payloads.
- Failure injection uses explicit local adapters and bounded leases.
- Router learning cannot relax provider availability, authentication, capability, local-only, cost, sandbox, or policy constraints.
- Accept clicks alone never create a positive reward.

## Performance constraints

- All new services are lazy and accessed through one facade.
- `src/app.mjs` stays at or below 160 static imports and 180 constructor expressions.
- Simple low-risk tasks remain on the existing fast path.
- Calibration and bandit stores use bounded SQLite rows and public summaries.
- Verification planning itself performs no subprocess execution.

## Testing strategy

Each component is developed with RED→GREEN tests. Integration tests prove lazy loading, privacy, criterion binding, disagreement blocking, fault recovery, and shadow-only routing. Release measurement uses deterministic local fixtures and clearly separates contract-tested behavior from production-certified behavior.

## Release evidence and non-claims

The 2.25 gate must prove the full local data flow and update the 1,150-item audit. It must state that production multi-provider independence, real hidden hosted regression sets, long-term patch-survival learning, and broad platform failure-injection certification are not yet proven.
