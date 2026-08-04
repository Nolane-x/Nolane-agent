# Forge Studio 2.24.0 — Long-Horizon Construction Engine Design

## Purpose

Forge Studio 2.24.0 turns long-running software construction from a prose plan into a bounded, evidence-backed state machine. The release must prevent edits when requirements are contradictory, preserve hard invariants across many patches, trace every requirement to implementation and verification, and choose the smallest correct patch rather than the smallest textual diff.

## Scope

This release implements the 2.24.0 slice of frontier section 35 and the adjacent semantic patch requirements needed to make it enforceable. It does not claim autonomous product construction without model/provider quality, production cloud CI, or independent benchmark evidence.

## Architecture

### 1. Construction Control Plane

Create `src/construction/construction-control-plane.mjs` as the only public facade for this release. It owns lazy instances of the specification compiler, traceability ledger, invariant ledger, executable plan engine, state capsule store, semantic patch analyzer, test impact selector, candidate selector, prospective obligation ledger, goal conflict resolver, and completion proof builder.

The facade has no direct filesystem mutation capability. It compiles, verifies, authorizes, records, resumes, and produces receipts. Existing patch and mission services remain the only mutation/execution paths.

### 2. Specification Compiler

`SpecificationCompiler.compile(input)` consumes a bounded structured request and produces:

- goal and weighted acceptance criteria;
- non-goals;
- hard and negotiable constraints;
- public interfaces and compatibility rules;
- invariants;
- affected components;
- migration/security/performance requirements;
- verification plan;
- contradiction findings;
- immutable SHA-256 receipt.

The compiler is deterministic. It does not use an LLM in Core. Model-generated drafts may be passed into the compiler, but only the compiler output is authoritative. Contradictions such as “public API must not change” plus “rename public method without compatibility adapter” block construction.

### 3. Requirement Traceability and Invariant Ledger

`RequirementTraceabilityLedger` stores typed links:

`requirement → decision → plan step → changed symbol → test → verification receipt`

Links are content-addressed, versioned, and must reference existing nodes. A requirement is complete only when every required verification link exists and passes.

`InvariantLedger` stores owner, severity, verifier, source hash, protected scope, and lifecycle. Critical invariant failures block patch authorization. Stale source hashes invalidate prior invariant verification.

### 4. Executable Plan State Machine

Each step contains:

- preconditions;
- inputs and outputs;
- allowed files and forbidden changes;
- expected intermediate state and effect;
- verification commands/checks;
- stop condition;
- fallback;
- dependency list;
- bounded retry and correction budget.

Allowed transitions are `pending → ready → running → verifying → completed`, with explicit `blocked`, `failed`, `rolled_back`, and `superseded` states. A step cannot run before dependencies and preconditions are satisfied. A verification failure cannot be converted to completion by a planner or model message.

Hierarchical plans use `mission → milestone → capability → contract → executable step → verification` and reuse existing mission IDs and receipts.

### 5. State Capsules, Revalidation, and Prospective Obligations

After each checkpoint, `StateCapsuleStore` persists a bounded content-addressed capsule containing current goal, completed criteria, decisions, invariants, changed symbols, tests, risks, Git checkpoint, repository fingerprint, and next ready steps.

Resume validates schema, receipt, repository fingerprint, plan revision, invariant revision, and referenced checkpoint. Mismatch produces `revalidation-required`, never silent continuation.

`ProspectiveObligationLedger` records “when state X occurs, perform verification/cleanup Y.” Obligations cannot be marked complete before their trigger and evidence receipt exist.

### 6. Goal Conflict Resolution

`GoalConflictResolver` distinguishes hard constraints from negotiable goals. It detects conflicts, rejects any option violating hard constraints, ranks remaining trade-offs, and records the selected resolution. The resolver cannot silently weaken a hard constraint or acceptance criterion.

### 7. Semantic Patch Intelligence

`SemanticPatchAnalyzer` measures:

- changed symbols and callers;
- public API signature/error/default changes;
- schema/config/dependency changes;
- control-flow and permission changes;
- security-critical scope;
- generated/test weakening findings;
- textual lines/files;
- reverted lines and correction lineage.

It returns a semantic footprint score and reasons. `DynamicPatchBudget` derives limits from task kind and risk. Bug fixes default to 2 files/80 changed lines unless evidence justifies expansion. Opportunistic refactors are rejected when they do not satisfy a traced criterion.

`TestImpactSelector` maps changed symbols and dependency/test evidence to a staged verification pyramid: syntax/type, targeted, module, integration, mutation probe, then full suite when risk requires it.

### 8. Candidate Competition

`CandidatePatchSelector` accepts two or three isolated candidate results. Selection order is:

1. all hard constraints and acceptance criteria verified;
2. no critical invariant or regression failure;
3. smallest semantic footprint;
4. highest verified value per token/RAM/edit cost;
5. smallest textual diff.

Candidate artifacts must name their isolated worktree/checkpoint and share the same verification contract. The selector does not create Git worktrees itself; the existing worktree service remains responsible for isolation.

### 9. Completion Proof Bundle

A mission is complete only when `CompletionProofBuilder` can produce:

- acceptance criteria matrix;
- requirement traceability projection;
- changed symbols and semantic footprint;
- architecture decisions;
- invariant verification;
- test/browser/security/performance receipts as applicable;
- residual risks and limitations;
- rollback point;
- bundle SHA-256.

Missing required evidence produces an incomplete bundle with explicit gaps, not a completion claim.

## Runtime Integration

`DecisionPlane` lazily owns `ConstructionControlPlane`. AgentLoop and MissionPlanner may request construction operations only when a mission is marked long-horizon or contains structured specification/plan contracts. Simple tasks retain the existing fast path.

The app composition root receives no new direct construction imports. The construction plane is reached through the existing Decision Plane facade, preserving startup and composition budgets.

## Privacy and Safety

- No chain-of-thought, raw prompt, raw model output, secret, environment dump, or raw command is stored.
- All receipts are bounded and content-addressed.
- Construction components cannot mutate files, merge branches, weaken criteria, or disable verifiers.
- Irreversible or hosted actions remain behind existing capability and human-control gates.
- Candidate and completion claims are local evidence only, not proof of superiority over other agents.

## Testing Strategy

Every component uses RED→GREEN tests. Integration tests must cover:

- contradictory specification blocks edit authorization;
- complete traceability is required for criterion completion;
- stale invariant verification is rejected;
- invalid executable-plan transitions fail closed;
- state capsule resumes exactly and rejects repository drift;
- prospective obligation fires only after trigger evidence;
- semantic footprint ranks a 5-line public API break above a 30-line internal safe patch;
- dynamic patch budget rejects unrelated refactor;
- impacted tests are selected by symbol/dependency evidence;
- correct candidate wins before resource efficiency is considered;
- proof bundle refuses missing evidence;
- simple AgentLoop path does not load construction services;
- no private/raw fields appear in snapshots or receipts.

## Release Evidence

The `long-horizon-construction` release gate must measure a deterministic local mission from specification compilation through plan execution authorization, patch analysis, candidate selection, checkpoint/resume, and completion proof. It must include non-claims for model quality, hosted workflows, production multi-repository transactions, and benchmark superiority.

## Audit Transition

2.24.0 may mark only directly implemented and release-gated requirements as `verified_source_test`. Requirements involving real production model planning, independent candidate generation quality, hosted CI, or cross-device reboot certification remain `partial` or `external_gate`.
