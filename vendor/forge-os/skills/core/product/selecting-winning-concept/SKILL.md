---
name: selecting-winning-concept
description: "Use when selecting winning concept is required during product work, especially when the result must be traceable, independently reviewable, and safe to hand to another agent."
license: MIT
compatibility: "ForgeOS-compatible Agent Skills hosts; no provider-specific model required."
metadata:
  author: forgeos-community
  version: "0.2.0"
  pack: product
  kind: core
  status: stable
---

# Selecting Winning Concept

## Overview

This skill owns one bounded responsibility: **selecting winning concept**. Its focus is select a product direction through evidence, pairwise trade-offs, and explicit human ownership. It converts declared inputs into typed artifacts and reproducible evidence without silently changing product scope.

## Trigger

Activate only when the project is in one of these stages: `selection`, `product-definition`, all contract preconditions pass, and the router identifies a missing output this skill can produce. Do not activate merely because the skill name resembles the user request.

## Required Inputs

- `scored-ideas`
- Current gate result, open findings, artifact hashes, and invalidation state
- Required tools: none
- Optional tools: none
- Confirmed human decisions relevant to this scope

## Method-Specific Protocol

1. Reject candidates that fail non-negotiable constraints before scoring.
2. Compare pairs separately on novelty, usefulness, feasibility, leverage, defensibility, testability, clarity, and evidence.
3. Run assumption sensitivity to identify candidates whose rank collapses under plausible changes.
4. Present practical, bold-plausible, and weirdly-useful finalists rather than one blended list.
5. Record the human selection, rationale, rejected alternatives, and invalidated downstream work.

## Procedure

1. Read confirmed evidence, selected concept, and unresolved assumptions.
2. Define the product decision this skill owns.
3. Reject candidates that fail non-negotiable constraints before scoring.
4. Compare pairs separately on novelty, usefulness, feasibility, leverage, defensibility, testability, clarity, and evidence.
5. Run assumption sensitivity to identify candidates whose rank collapses under plausible changes.
6. Present practical, bold-plausible, and weirdly-useful finalists rather than one blended list.
7. Record the human selection, rationale, rejected alternatives, and invalidated downstream work.
8. Model alternatives and explicit trade-offs.
9. Choose a testable position with non-goals.
10. Trace the decision to users, value, risks, and metrics.
11. Publish the decision artifact and downstream invalidations.

## Verification Questions

- Can the winner explain why it beats the runner-up?
- Is a high novelty score hiding poor usefulness?
- Has the human—not the worker—owned the final product direction?
- Is the cheapest falsification experiment defined?

## Evidence Packet

Produce or reference all applicable evidence:

- `pairwise matrix`
- `sensitivity report`
- `selection decision`
- `rejected-alternative record`

Evidence must identify the current artifact hash, command or method used, result, reviewer identity, timestamp, and limitations.

## Output Contract

Produce:
- `selected-concept`

The primary artifact must include schema version, provenance, consumed artifact IDs, decisions, evidence references, residual risks, validation state, and invalidation targets. Narrative explanation may accompany the artifact but cannot replace it.

## Quality Gate

Reviewer: `independent-reviewer`

- The output directly and completely performs selecting winning concept within its declared boundary.
- Can the winner explain why it beats the runner-up?
- Is a high novelty score hiding poor usefulness?
- Has the human—not the worker—owned the final product direction?
- Is the cheapest falsification experiment defined?
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
- averaging incompatible criteria
- letting the generator self-select
- choosing the most polished prose

## Escalation and Invalidation

Stop and request a human decision when scope, risk acceptance, irreversible action, cost ceiling, privacy boundary, or product direction is materially ambiguous. When this artifact changes, invalidate only descendants named by the artifact graph; preserve unaffected verified branches.

## Handoff

- Next transition: the graph router selects a real consumer of `selected-concept`.
- Required evidence: `contract-validation`, `independent-review`, `pairwise matrix`, `sensitivity report`, `selection decision`, `rejected-alternative record`.
- Required envelope fields: `artifactId`, `schemaVersion`, `sha256`, `producingSkill`, `producingAgent`, `consumedArtifacts`, `decisionIds`, `evidenceIds`, `residualRisks`, `validationState`, `invalidationTargets`, `stopCondition`.
- Stop condition: Output contract is satisfied, a blocker is recorded, or a material human decision is required.

## Token and Context Policy

Load at most 8 direct artifacts and reference depth 1. Use stable IDs, hashes, signatures, and deltas instead of repeating full history. Use established domain terminology, state each requirement once, and spend context on decisions, code, tests, or evidence rather than narration.

## Reference Playbook

Load [skills/references/core/product.md](../../../references/core/product.md) only when this skill needs pack-wide decision tables, evidence patterns, or cross-skill handoff rules.

See `contract.json` for the machine-readable contract.
