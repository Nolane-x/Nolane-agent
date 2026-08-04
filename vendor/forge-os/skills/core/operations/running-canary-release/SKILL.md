---
name: running-canary-release
description: "Use when running canary release is required during operations work, especially when the result must be traceable, independently reviewable, and safe to hand to another agent."
license: MIT
compatibility: "ForgeOS-compatible Agent Skills hosts; no provider-specific model required."
metadata:
  author: forgeos-community
  version: "0.2.0"
  pack: operations
  kind: core
  status: candidate
---

# Running Canary Release

## Overview

This skill owns one bounded responsibility: **running canary release**. Its focus is running canary release within operations lifecycle boundaries. It converts declared inputs into typed artifacts and reproducible evidence without silently changing product scope.

## Trigger

Activate only when the project is in one of these stages: `implementation`, `verification`, `release-readiness`, `released`, all contract preconditions pass, and the router identifies a missing output this skill can produce. Do not activate merely because the skill name resembles the user request.

## Required Inputs

- `verified-build`
- Optional: `architecture-decision`
- Current gate result, open findings, artifact hashes, and invalidation state
- Required tools: none
- Optional tools: `shell`, `container-runtime`
- Confirmed human decisions relevant to this scope

## Method-Specific Protocol

1. Define the exact decision, actors, objects, states, invariants, side effects, and non-goals owned by running canary release.
2. Build a decision table for normal, boundary, invalid, permission, failure, retry, recovery, concurrency, migration, and abuse conditions relevant to running canary release.
3. Apply running canary release only to direct input artifacts; record assumptions, rejected alternatives, and any human decision still required.
4. Trace the resulting contract to user value, security, reliability, cost, operability, and downstream consumers.
5. Create reproducible checks that would fail if running canary release were incomplete or implemented incorrectly.

## Procedure

1. Read deployment topology, service objectives, and rollback constraints.
2. Define observable success and failure signals.
3. Define the exact decision, actors, objects, states, invariants, side effects, and non-goals owned by running canary release.
4. Build a decision table for normal, boundary, invalid, permission, failure, retry, recovery, concurrency, migration, and abuse conditions relevant to running canary release.
5. Apply running canary release only to direct input artifacts; record assumptions, rejected alternatives, and any human decision still required.
6. Trace the resulting contract to user value, security, reliability, cost, operability, and downstream consumers.
7. Create reproducible checks that would fail if running canary release were incomplete or implemented incorrectly.
8. Rehearse the operational change in a controlled environment.
9. Verify monitoring, alerting, rollback, and incident ownership.
10. Capture production-safe evidence and residual risks.
11. Publish an operations artifact with explicit go/no-go criteria.

## Verification Questions

- Does the artifact make the owned decision for running canary release explicit and bounded?
- Are failure, recovery, permissions, concurrency, and irreversible side effects addressed where applicable?
- Can every load-bearing claim be traced to a confirmed fact, direct artifact, executable check, or declared assumption?
- Would a downstream agent know exactly what changed, what remains open, and what must be invalidated?

## Evidence Packet

Produce or reference all applicable evidence:

- `running-canary-release-decision-table`
- `running-canary-release-verification-report`
- `running-canary-release-handoff-envelope`

Evidence must identify the current artifact hash, command or method used, result, reviewer identity, timestamp, and limitations.

## Output Contract

Produce:
- `deployment-plan`
- `operations-evidence`

The primary artifact must include schema version, provenance, consumed artifact IDs, decisions, evidence references, residual risks, validation state, and invalidation targets. Narrative explanation may accompany the artifact but cannot replace it.

## Quality Gate

Reviewer: `independent-reviewer`

- The output directly and completely performs running canary release within its declared boundary.
- Does the artifact make the owned decision for running canary release explicit and bounded?
- Are failure, recovery, permissions, concurrency, and irreversible side effects addressed where applicable?
- Can every load-bearing claim be traced to a confirmed fact, direct artifact, executable check, or declared assumption?
- Would a downstream agent know exactly what changed, what remains open, and what must be invalidated?
- Every material claim is traceable to an input, decision, executable check, or evidence item.
- Required fields are complete and machine-readable.
- The producing agent is not the approving reviewer.
- Open uncertainty and residual risk are explicit; critical findings are never hidden by an aggregate score.

Pass only when: All mandatory rules pass, evidence targets the current artifact hash, and no unresolved critical finding applies.

## Forbidden Shortcuts

- Do not infer a material requirement that the user has not confirmed.
- Do not replace a typed artifact with a long explanation.
- Do not approve work produced by the same agent identity.
- Do not hide a critical failure behind a high aggregate score.
- Do not load unrelated project history, files, references, or skill bodies.
- Do not mark evidence complete when it targets a different artifact hash or version.

## Failure Modes

- guessing a material requirement
- producing prose without the contracted artifact
- self-approving the output
- expanding scope without a decision record
- treating running canary release as a naming exercise
- covering only the happy path
- creating extension points without a current contract or consumer

## Escalation and Invalidation

Stop and request a human decision when scope, risk acceptance, irreversible action, cost ceiling, privacy boundary, or product direction is materially ambiguous. When this artifact changes, invalidate only descendants named by the artifact graph; preserve unaffected verified branches.

## Handoff

- Next transition: the graph router selects a real consumer of `deployment-plan`, `operations-evidence`.
- Required evidence: `contract-validation`, `independent-review`, `running-canary-release-decision-table`, `running-canary-release-verification-report`, `running-canary-release-handoff-envelope`.
- Required envelope fields: `artifactId`, `schemaVersion`, `sha256`, `producingSkill`, `producingAgent`, `consumedArtifacts`, `decisionIds`, `evidenceIds`, `residualRisks`, `validationState`, `invalidationTargets`, `stopCondition`.
- Stop condition: Output contract is satisfied, a blocker is recorded, or a material human decision is required.

## Token and Context Policy

Load at most 8 direct artifacts and reference depth 1. Use stable IDs, hashes, signatures, and deltas instead of repeating full history. Use established domain terminology, state each requirement once, and spend context on decisions, code, tests, or evidence rather than narration.

## Reference Playbook

Load [skills/references/core/operations.md](../../../references/core/operations.md) only when this skill needs pack-wide decision tables, evidence patterns, or cross-skill handoff rules.

See `contract.json` for the machine-readable contract.
