---
name: testing-properties-and-invariants
description: "Use when testing properties and invariants is required during quality work, especially when the result must be traceable, independently reviewable, and safe to hand to another agent."
license: MIT
compatibility: "ForgeOS-compatible Agent Skills hosts; no provider-specific model required."
metadata:
  author: forgeos-community
  version: "0.2.0"
  pack: quality
  kind: core
  status: stable
---

# Testing Properties And Invariants

## Overview

This skill owns one bounded responsibility: **testing properties and invariants**. Its focus is verify domain invariants across generated inputs, state transitions, serialization, retries, and boundary combinations. It converts declared inputs into typed artifacts and reproducible evidence without silently changing product scope.

## Trigger

Activate only when the project is in one of these stages: `verification`, all contract preconditions pass, and the router identifies a missing output this skill can produce. Do not activate merely because the skill name resembles the user request.

## Required Inputs

- `test-plan`
- `verified-build`
- Optional: `domain-evidence`
- Current gate result, open findings, artifact hashes, and invalidation state
- Required tools: `test-runner`
- Optional tools: none
- Confirmed human decisions relevant to this scope

## Method-Specific Protocol

1. Extract invariants from domain and acceptance contracts.
2. Define generators that cover valid, invalid, boundary, and structurally diverse values.
3. Use shrinking to minimize failing cases and persist seeds.
4. Test invariants across round trips, permutations, retries, and state transitions.
5. Convert every discovered counterexample into a deterministic regression fixture.

## Procedure

1. Derive checks from requirements, contracts, invariants, and observed risks.
2. Create a test that can fail for the intended defect class.
3. Extract invariants from domain and acceptance contracts.
4. Define generators that cover valid, invalid, boundary, and structurally diverse values.
5. Use shrinking to minimize failing cases and persist seeds.
6. Test invariants across round trips, permutations, retries, and state transitions.
7. Convert every discovered counterexample into a deterministic regression fixture.
8. Run the test against the current system and record the baseline.
9. Exercise positive, negative, boundary, and recovery behavior.
10. Classify findings by impact, reproducibility, and affected scope.
11. Publish evidence without masking critical failures behind aggregate scores.

## Verification Questions

- Is the property stronger than a handful of examples?
- Can the generator reach boundary structures?
- Is non-determinism seeded and reproducible?
- Does shrinking preserve the failure cause?

## Evidence Packet

Produce or reference all applicable evidence:

- `property catalog`
- `generator definitions`
- `seed corpus`
- `minimized regressions`

Evidence must identify the current artifact hash, command or method used, result, reviewer identity, timestamp, and limitations.

## Output Contract

Produce:
- `verification-report`
- `ux-evidence`

The primary artifact must include schema version, provenance, consumed artifact IDs, decisions, evidence references, residual risks, validation state, and invalidation targets. Narrative explanation may accompany the artifact but cannot replace it.

## Quality Gate

Reviewer: `quality-reviewer`

- The output directly and completely performs testing properties and invariants within its declared boundary.
- Is the property stronger than a handful of examples?
- Can the generator reach boundary structures?
- Is non-determinism seeded and reproducible?
- Does shrinking preserve the failure cause?
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
- tautological properties
- random tests without reproducibility
- discarding too many generated cases

## Escalation and Invalidation

Stop and request a human decision when scope, risk acceptance, irreversible action, cost ceiling, privacy boundary, or product direction is materially ambiguous. When this artifact changes, invalidate only descendants named by the artifact graph; preserve unaffected verified branches.

## Handoff

- Next transition: the graph router selects a real consumer of `verification-report`, `ux-evidence`.
- Required evidence: `contract-validation`, `independent-review`, `property catalog`, `generator definitions`, `seed corpus`, `minimized regressions`.
- Required envelope fields: `artifactId`, `schemaVersion`, `sha256`, `producingSkill`, `producingAgent`, `consumedArtifacts`, `decisionIds`, `evidenceIds`, `residualRisks`, `validationState`, `invalidationTargets`, `stopCondition`.
- Stop condition: Output contract is satisfied, a blocker is recorded, or a material human decision is required.

## Token and Context Policy

Load at most 8 direct artifacts and reference depth 1. Use stable IDs, hashes, signatures, and deltas instead of repeating full history. Use established domain terminology, state each requirement once, and spend context on decisions, code, tests, or evidence rather than narration.

## Reference Playbook

Load [skills/references/core/quality.md](../../../references/core/quality.md) only when this skill needs pack-wide decision tables, evidence patterns, or cross-skill handoff rules.

See `contract.json` for the machine-readable contract.
