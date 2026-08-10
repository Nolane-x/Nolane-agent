---
name: designing-interaction-contracts
description: "Use when designing interaction contracts is required during ux work, especially when the result must be traceable, independently reviewable, and safe to hand to another agent."
license: MIT
compatibility: "ForgeOS-compatible Agent Skills hosts; no provider-specific model required."
metadata:
  author: forgeos-community
  version: "0.2.0"
  pack: ux
  kind: core
  status: stable
---

# Designing Interaction Contracts

## Overview

This skill owns one bounded responsibility: **designing interaction contracts**. Its focus is specify complete user-system behavior across states, errors, latency, permissions, recovery, and accessibility. It converts declared inputs into typed artifacts and reproducible evidence without silently changing product scope.

## Trigger

Activate only when the project is in one of these stages: `ux-design`, all contract preconditions pass, and the router identifies a missing output this skill can produce. Do not activate merely because the skill name resembles the user request.

## Required Inputs

- `product-definition`
- `user-workflows`
- Current gate result, open findings, artifact hashes, and invalidation state
- Required tools: none
- Optional tools: none
- Confirmed human decisions relevant to this scope

## Method-Specific Protocol

1. Enumerate user intents and system states for each critical interaction.
2. Define input constraints, feedback, optimistic behavior, loading, empty, partial, error, permission, and recovery states.
3. Specify keyboard, screen-reader, focus, motion, and responsive behavior.
4. Map each visible state to backend contracts and telemetry.
5. Create executable acceptance scenarios before visual polish.

## Procedure

1. Read user workflows, constraints, devices, and accessibility needs.
2. Define critical journeys and failure recovery before visual styling.
3. Enumerate user intents and system states for each critical interaction.
4. Define input constraints, feedback, optimistic behavior, loading, empty, partial, error, permission, and recovery states.
5. Specify keyboard, screen-reader, focus, motion, and responsive behavior.
6. Map each visible state to backend contracts and telemetry.
7. Create executable acceptance scenarios before visual polish.
8. Specify interaction states, information hierarchy, and feedback.
9. Create responsive and accessible behavior contracts.
10. Validate critical flows against realistic user tasks.
11. Publish UI evidence, open questions, and handoff contracts.

## Verification Questions

- Is every asynchronous action observable and recoverable?
- Can a keyboard-only user complete the critical flow?
- Do frontend states correspond to real backend outcomes?
- Are destructive actions reversible or explicitly confirmed?

## Evidence Packet

Produce or reference all applicable evidence:

- `interaction state table`
- `accessibility contract`
- `acceptance scenarios`
- `backend mapping`

Evidence must identify the current artifact hash, command or method used, result, reviewer identity, timestamp, and limitations.

## Output Contract

Produce:
- `ux-contract`

The primary artifact must include schema version, provenance, consumed artifact IDs, decisions, evidence references, residual risks, validation state, and invalidation targets. Narrative explanation may accompany the artifact but cannot replace it.

## Quality Gate

Reviewer: `independent-reviewer`

- The output directly and completely performs designing interaction contracts within its declared boundary.
- Is every asynchronous action observable and recoverable?
- Can a keyboard-only user complete the critical flow?
- Do frontend states correspond to real backend outcomes?
- Are destructive actions reversible or explicitly confirmed?
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
- happy-path mockups only
- inventing backend states
- using color as the only signal

## Escalation and Invalidation

Stop and request a human decision when scope, risk acceptance, irreversible action, cost ceiling, privacy boundary, or product direction is materially ambiguous. When this artifact changes, invalidate only descendants named by the artifact graph; preserve unaffected verified branches.

## Handoff

- Next transition: the graph router selects a real consumer of `ux-contract`.
- Required evidence: `contract-validation`, `independent-review`, `interaction state table`, `accessibility contract`, `acceptance scenarios`, `backend mapping`.
- Required envelope fields: `artifactId`, `schemaVersion`, `sha256`, `producingSkill`, `producingAgent`, `consumedArtifacts`, `decisionIds`, `evidenceIds`, `residualRisks`, `validationState`, `invalidationTargets`, `stopCondition`.
- Stop condition: Output contract is satisfied, a blocker is recorded, or a material human decision is required.

## Token and Context Policy

Load at most 8 direct artifacts and reference depth 1. Use stable IDs, hashes, signatures, and deltas instead of repeating full history. Use established domain terminology, state each requirement once, and spend context on decisions, code, tests, or evidence rather than narration.

## Reference Playbook

Load [skills/references/core/ux.md](../../../references/core/ux.md) only when this skill needs pack-wide decision tables, evidence patterns, or cross-skill handoff rules.

See `contract.json` for the machine-readable contract.
