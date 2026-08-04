---
name: reviewing-architecture-risks
description: "Use when reviewing architecture risks is required during architecture work, especially when the result must be traceable, independently reviewable, and safe to hand to another agent."
license: MIT
compatibility: "ForgeOS-compatible Agent Skills hosts; no provider-specific model required."
metadata:
  author: forgeos-community
  version: "0.2.0"
  pack: architecture
  kind: core
  status: candidate
---

# Reviewing Architecture Risks

## Overview

This skill owns one bounded responsibility: **reviewing architecture risks**. Its focus is reviewing architecture risks within architecture lifecycle boundaries. It converts declared inputs into typed artifacts and reproducible evidence without silently changing product scope.

## Trigger

Activate only when the project is in one of these stages: `architecture`, all contract preconditions pass, and the router identifies a missing output this skill can produce. Do not activate merely because the skill name resembles the user request.

## Required Inputs

- `system-boundaries`
- `product-definition`
- Optional: `ux-contract`
- Optional: `domain-blueprint`
- Current gate result, open findings, artifact hashes, and invalidation state
- Required tools: none
- Optional tools: none
- Confirmed human decisions relevant to this scope

## Method-Specific Protocol

1. Define the exact decision, actors, objects, states, invariants, side effects, and non-goals owned by reviewing architecture risks.
2. Build a decision table for normal, boundary, invalid, permission, failure, retry, recovery, concurrency, migration, and abuse conditions relevant to reviewing architecture risks.
3. Apply reviewing architecture risks only to direct input artifacts; record assumptions, rejected alternatives, and any human decision still required.
4. Trace the resulting contract to user value, security, reliability, cost, operability, and downstream consumers.
5. Create reproducible checks that would fail if reviewing architecture risks were incomplete or implemented incorrectly.

## Procedure

1. Read product capabilities, quality attributes, and domain constraints.
2. Define boundaries and stable contracts before implementation details.
3. Define the exact decision, actors, objects, states, invariants, side effects, and non-goals owned by reviewing architecture risks.
4. Build a decision table for normal, boundary, invalid, permission, failure, retry, recovery, concurrency, migration, and abuse conditions relevant to reviewing architecture risks.
5. Apply reviewing architecture risks only to direct input artifacts; record assumptions, rejected alternatives, and any human decision still required.
6. Trace the resulting contract to user value, security, reliability, cost, operability, and downstream consumers.
7. Create reproducible checks that would fail if reviewing architecture risks were incomplete or implemented incorrectly.
8. Model data, failures, extension points, and operational behavior.
9. Evaluate at least two viable alternatives and trade-offs.
10. Threat-model the selected design and its dependencies.
11. Publish an architecture decision with validation evidence.

## Verification Questions

- Does the artifact make the owned decision for reviewing architecture risks explicit and bounded?
- Are failure, recovery, permissions, concurrency, and irreversible side effects addressed where applicable?
- Can every load-bearing claim be traced to a confirmed fact, direct artifact, executable check, or declared assumption?
- Would a downstream agent know exactly what changed, what remains open, and what must be invalidated?

## Evidence Packet

Produce or reference all applicable evidence:

- `reviewing-architecture-risks-decision-table`
- `reviewing-architecture-risks-verification-report`
- `reviewing-architecture-risks-handoff-envelope`

Evidence must identify the current artifact hash, command or method used, result, reviewer identity, timestamp, and limitations.

## Output Contract

Produce:
- `architecture-decision`

The primary artifact must include schema version, provenance, consumed artifact IDs, decisions, evidence references, residual risks, validation state, and invalidation targets. Narrative explanation may accompany the artifact but cannot replace it.

## Quality Gate

Reviewer: `independent-reviewer`

- The output directly and completely performs reviewing architecture risks within its declared boundary.
- Does the artifact make the owned decision for reviewing architecture risks explicit and bounded?
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
- treating reviewing architecture risks as a naming exercise
- covering only the happy path
- creating extension points without a current contract or consumer

## Escalation and Invalidation

Stop and request a human decision when scope, risk acceptance, irreversible action, cost ceiling, privacy boundary, or product direction is materially ambiguous. When this artifact changes, invalidate only descendants named by the artifact graph; preserve unaffected verified branches.

## Handoff

- Next transition: the graph router selects a real consumer of `architecture-decision`.
- Required evidence: `contract-validation`, `independent-review`, `reviewing-architecture-risks-decision-table`, `reviewing-architecture-risks-verification-report`, `reviewing-architecture-risks-handoff-envelope`.
- Required envelope fields: `artifactId`, `schemaVersion`, `sha256`, `producingSkill`, `producingAgent`, `consumedArtifacts`, `decisionIds`, `evidenceIds`, `residualRisks`, `validationState`, `invalidationTargets`, `stopCondition`.
- Stop condition: Output contract is satisfied, a blocker is recorded, or a material human decision is required.

## Token and Context Policy

Load at most 8 direct artifacts and reference depth 1. Use stable IDs, hashes, signatures, and deltas instead of repeating full history. Use established domain terminology, state each requirement once, and spend context on decisions, code, tests, or evidence rather than narration.

## Reference Playbook

Load [skills/references/core/architecture.md](../../../references/core/architecture.md) only when this skill needs pack-wide decision tables, evidence patterns, or cross-skill handoff rules.

See `contract.json` for the machine-readable contract.
