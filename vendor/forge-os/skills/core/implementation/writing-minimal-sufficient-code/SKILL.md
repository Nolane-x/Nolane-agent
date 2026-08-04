---
name: writing-minimal-sufficient-code
description: "Use when writing minimal sufficient code is required during implementation work, especially when the result must be traceable, independently reviewable, and safe to hand to another agent."
license: MIT
compatibility: "ForgeOS-compatible Agent Skills hosts; no provider-specific model required."
metadata:
  author: forgeos-community
  version: "0.2.0"
  pack: implementation
  kind: core
  status: stable
---

# Writing Minimal Sufficient Code

## Overview

This skill owns one bounded responsibility: **writing minimal sufficient code**. Its focus is minimize code, dependencies, layers, and state while fully satisfying contracts, risks, and operability. It converts declared inputs into typed artifacts and reproducible evidence without silently changing product scope.

## Trigger

Activate only when the project is in one of these stages: `implementation`, all contract preconditions pass, and the router identifies a missing output this skill can produce. Do not activate merely because the skill name resembles the user request.

## Required Inputs

- `execution-plan`
- `acceptance-contracts`
- Current gate result, open findings, artifact hashes, and invalidation state
- Required tools: `filesystem`, `shell`
- Optional tools: none
- Confirmed human decisions relevant to this scope

## Method-Specific Protocol

1. List required behaviors, quality attributes, and extension points that have current consumers.
2. Choose the fewest concepts that make invalid states hard to represent.
3. Delete duplicate paths, speculative flags, pass-through layers, and narration-shaped abstractions.
4. Measure complexity through public surface, branches, state transitions, dependencies, and change amplification—not line count alone.
5. Verify behavior and readability after simplification.

## Procedure

1. Load one task, its direct contracts, and its failing test.
2. Verify the test fails for the intended missing behavior.
3. List required behaviors, quality attributes, and extension points that have current consumers.
4. Choose the fewest concepts that make invalid states hard to represent.
5. Delete duplicate paths, speculative flags, pass-through layers, and narration-shaped abstractions.
6. Measure complexity through public surface, branches, state transitions, dependencies, and change amplification—not line count alone.
7. Verify behavior and readability after simplification.
8. Implement the minimum sufficient change.
9. Run focused tests, then relevant regression tests.
10. Review the diff for complexity, security, and contract drift.
11. Commit evidence and hand off to independent review.

## Verification Questions

- Does every public abstraction have at least one real consumer?
- Can a layer be removed without losing a contract or boundary?
- Is configuration replacing a missing product decision?
- Did simplification preserve tests, observability, and security?

## Evidence Packet

Produce or reference all applicable evidence:

- `complexity budget`
- `deleted-code diff`
- `behavior regression report`

Evidence must identify the current artifact hash, command or method used, result, reviewer identity, timestamp, and limitations.

## Output Contract

Produce:
- `implemented-increment`

The primary artifact must include schema version, provenance, consumed artifact IDs, decisions, evidence references, residual risks, validation state, and invalidation targets. Narrative explanation may accompany the artifact but cannot replace it.

## Quality Gate

Reviewer: `independent-reviewer`

- The output directly and completely performs writing minimal sufficient code within its declared boundary.
- Does every public abstraction have at least one real consumer?
- Can a layer be removed without losing a contract or boundary?
- Is configuration replacing a missing product decision?
- Did simplification preserve tests, observability, and security?
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
- code golf
- premature frameworks
- one interface per class without substitution

## Escalation and Invalidation

Stop and request a human decision when scope, risk acceptance, irreversible action, cost ceiling, privacy boundary, or product direction is materially ambiguous. When this artifact changes, invalidate only descendants named by the artifact graph; preserve unaffected verified branches.

## Handoff

- Next transition: the graph router selects a real consumer of `implemented-increment`.
- Required evidence: `contract-validation`, `independent-review`, `complexity budget`, `deleted-code diff`, `behavior regression report`.
- Required envelope fields: `artifactId`, `schemaVersion`, `sha256`, `producingSkill`, `producingAgent`, `consumedArtifacts`, `decisionIds`, `evidenceIds`, `residualRisks`, `validationState`, `invalidationTargets`, `stopCondition`.
- Stop condition: Output contract is satisfied, a blocker is recorded, or a material human decision is required.

## Token and Context Policy

Load at most 8 direct artifacts and reference depth 1. Use stable IDs, hashes, signatures, and deltas instead of repeating full history. Use established domain terminology, state each requirement once, and spend context on decisions, code, tests, or evidence rather than narration.

## Reference Playbook

Load [skills/references/core/implementation.md](../../../references/core/implementation.md) only when this skill needs pack-wide decision tables, evidence patterns, or cross-skill handoff rules.

See `contract.json` for the machine-readable contract.
