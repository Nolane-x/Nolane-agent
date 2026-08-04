# Forge Studio 3.0 Frontier Governance Design

## Goal

Deliver a local-first 3.0 control plane that can plan and verify cross-repository changes, propose bounded self-healing repairs, measure change survival, preserve cultural lineage, and govern any policy/skill/memory update through an immutable self-improvement constitution.

## Non-goals

- No autonomous merge, release publish, capability expansion, verifier disablement, audit deletion, or network/filesystem broadening.
- No claim that Forge Studio is AGI or superior to Codex, Claude Code, Cursor, or Copilot without independent comparative evidence.
- No cloud dependency, hosted control plane, or secret-bearing transcript storage.
- No claim that a simulated 7–30 day survival window proves production durability; the ledger supports real timestamps and deterministic clock-driven tests, while production survival remains evidence-dependent.

## Architecture

### 1. Cross-Repository Workspace Graph

`CrossRepositoryWorkspaceMap` owns a bounded graph of repositories, packages, public contracts, deployment units, and dependency edges. Every node and edge includes exact version, source fingerprint, owner, provenance, and a stable receipt. The graph rejects cycles in declared deployment order unless a compatibility window explicitly permits them.

### 2. Transactional Change Planner

`TransactionalChangePlanner` consumes the workspace graph and a set of requested repository changes. It computes dependency order, intermediate contracts, compatibility windows, verification checkpoints, and per-repository rollback points. A multi-root plan is marked transactional only when every repository has a baseline, reversible commit step, verification command, and all-or-rollback sequence.

### 3. Synchronized Commit Chain

`SynchronizedCommitChain` records prepared commits, provenance, expected contract revisions, verification receipts, and rollback commits. It never runs Git directly. A caller-provided adapter may create worktrees or commits, but the public receipt records only bounded metadata and hashes. The chain cannot become `ready-for-human-merge` until every repository is prepared and independently verified.

### 4. Post-Merge Sentinel and Incident Trace

`PostMergeSentinel` ingests bounded CI, crash, log, performance, and security signals. It correlates an incident to decision, patch, test, agent, and commit receipts. `ChangeSurvivalLedger` records revert, rewrite, bug, security regression, and debt signals over configurable 7–30 day windows. Survival-derived router/skill credit is emitted only after the observation window matures and remains shadow-only.

### 5. Self-Healing Coordinator

`SelfHealingCoordinator` accepts an incident trace and a worktree adapter. It authorizes a repair proposal only when the incident is directly linked to the candidate source, the baseline is clean, a regression test is specified, the repair lease is bounded, and rollback is available. It may create a proposal/worktree through the adapter, but cannot merge or publish.

### 6. Cultural Lineage Ledger

`CulturalLineageLedger` stores versioned skill, architecture decision, policy, and memory lineage across releases. Fork, merge, supersede, revoke, and rollback transitions require provenance and exact parent versions. No raw prompt or chain-of-thought is stored.

### 7. Self-Improvement Constitution

`SelfImprovementConstitution` is an immutable ruleset. It rejects any candidate that changes acceptance criteria, disables verifiers, deletes audit evidence, broadens filesystem/network access, expands autonomy, removes human merge approval, or lacks exact provenance/version/rollback. The required evidence threshold increases with irreversibility. Promotion must pass candidate → sandbox → held-out → regression → red-team → shadow → canary and must remain blocked until human approval.

### 8. Frontier Governance Plane

`FrontierGovernancePlane` lazily owns the seven services. `DecisionPlane` exposes bounded wrappers and a privacy-safe snapshot. `src/app.mjs` must not import frontier modules directly. Fast-path tasks must not instantiate the plane.

## Data flow

1. Register repositories and contracts in the workspace graph.
2. Compile a transactional plan with compatibility windows and rollback points.
3. Prepare a synchronized commit chain through an external adapter.
4. Require verification receipts and human merge approval.
5. Observe post-merge signals and correlate incidents to original receipts.
6. Propose a bounded self-healing worktree only for directly attributable failures.
7. Mature survival outcomes and emit shadow credit updates.
8. Evaluate any policy/skill/memory change through the constitution before promotion.

## Error handling and safety

- Every public object is canonical, finite, bounded, immutable, and SHA-256 signed.
- Stale repository fingerprints, missing rollback points, incomplete verification, ambiguous incident attribution, or missing human approval fail closed.
- Adapter errors are converted into bounded failure receipts; raw stdout/stderr and secret values are not stored.
- Multi-root plans without complete all-or-rollback coverage are explicitly `non-transactional`.
- Production promotion, merge, publish, delete, or capability expansion are never executed by the plane.

## Testing

- Unit tests for graph ordering, compatibility windows, rollback completeness, incident correlation, survival maturity, lineage transitions, and constitution rules.
- Integration test through `DecisionPlane` proving lazy lifecycle and privacy-safe snapshot.
- Release measurement using deterministic repository/worktree adapters and a clock-controlled survival window.
- Mandatory release gate `frontier-safety-and-self-healing` plus regression tests for prior planes and composition budgets.

## Honest status policy

Section 48 items may become `verified_source_test` only when source, direct tests, integration evidence, release gate, and limitations exist. Cross-platform computer-use, JetBrains parity, independent comparative superiority, and real 7–30 day field survival remain partial or external until corresponding raw evidence exists.
