---
name: optimizing-context-budget
description: "Use when optimizing context budget is required during meta work, especially when the result must be traceable, independently reviewable, and safe to hand to another agent."
license: MIT
compatibility: "ForgeOS-compatible Agent Skills hosts; no provider-specific model required."
metadata:
  author: forgeos-community
  version: "0.2.0"
  pack: meta
  kind: core
  status: stable
---

# Optimizing Context Budget

## Overview

This skill owns one bounded responsibility: **optimizing context budget**. Its focus is remove redundant context while preserving every fact, contract, dependency, and risk needed for correct execution. It converts declared inputs into typed artifacts and reproducible evidence without silently changing product scope.

## Trigger

Activate only when the project is in one of these stages: `discovery`, `planning`, `implementation`, `verification`, all contract preconditions pass, and the router identifies a missing output this skill can produce. Do not activate merely because the skill name resembles the user request.

## Required Inputs

- `behavioral-baseline`
- `candidate-change`
- Current gate result, open findings, artifact hashes, and invalidation state
- Required tools: none
- Optional tools: none
- Confirmed human decisions relevant to this scope

## Method-Specific Protocol

1. Measure current context by source, reuse, freshness, and decision value.
2. Replace repeated structures with stable IDs, hashes, signatures, and deltas.
3. Separate global metadata, selected skill bodies, direct artifacts, and on-demand references.
4. A/B test compressed and full contexts on task success and critical omissions.
5. Reject savings that reduce correctness, evidence quality, or recovery ability.

## Procedure

1. Identify the measured agent failure or capability gap.
2. Write a baseline scenario that exposes the gap without the candidate skill.
3. Measure current context by source, reuse, freshness, and decision value.
4. Replace repeated structures with stable IDs, hashes, signatures, and deltas.
5. Separate global metadata, selected skill bodies, direct artifacts, and on-demand references.
6. A/B test compressed and full contexts on task success and critical omissions.
7. Reject savings that reduce correctness, evidence quality, or recovery ability.
8. Design the smallest skill or adapter change that targets the failure.
9. Run paired behavioral evaluations across representative agents.
10. Measure success, quality, context, cost, and new failure modes.
11. Promote, revise, deprecate, or quarantine based on evidence.

## Verification Questions

- Is any removed fact load-bearing?
- Can the agent retrieve omitted detail on demand?
- Are stale summaries prevented by hashes?
- Did token reduction increase retries or rework?

## Evidence Packet

Produce or reference all applicable evidence:

- `context profile`
- `compressed pack`
- `A/B results`
- `omission audit`

Evidence must identify the current artifact hash, command or method used, result, reviewer identity, timestamp, and limitations.

## Output Contract

Produce:
- `skill-evaluation`

The primary artifact must include schema version, provenance, consumed artifact IDs, decisions, evidence references, residual risks, validation state, and invalidation targets. Narrative explanation may accompany the artifact but cannot replace it.

## Quality Gate

Reviewer: `independent-reviewer`

- The output directly and completely performs optimizing context budget within its declared boundary.
- Is any removed fact load-bearing?
- Can the agent retrieve omitted detail on demand?
- Are stale summaries prevented by hashes?
- Did token reduction increase retries or rework?
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
- arbitrary token caps
- summarizing code semantics away
- repeating instructions in every artifact

## Escalation and Invalidation

Stop and request a human decision when scope, risk acceptance, irreversible action, cost ceiling, privacy boundary, or product direction is materially ambiguous. When this artifact changes, invalidate only descendants named by the artifact graph; preserve unaffected verified branches.

## Handoff

- Next transition: the graph router selects a real consumer of `skill-evaluation`.
- Required evidence: `contract-validation`, `independent-review`, `context profile`, `compressed pack`, `A/B results`, `omission audit`.
- Required envelope fields: `artifactId`, `schemaVersion`, `sha256`, `producingSkill`, `producingAgent`, `consumedArtifacts`, `decisionIds`, `evidenceIds`, `residualRisks`, `validationState`, `invalidationTargets`, `stopCondition`.
- Stop condition: Output contract is satisfied, a blocker is recorded, or a material human decision is required.

## Token and Context Policy

Load at most 8 direct artifacts and reference depth 1. Use stable IDs, hashes, signatures, and deltas instead of repeating full history. Use established domain terminology, state each requirement once, and spend context on decisions, code, tests, or evidence rather than narration.

## Reference Playbook

Load [skills/references/core/meta.md](../../../references/core/meta.md) only when this skill needs pack-wide decision tables, evidence patterns, or cross-skill handoff rules.

See `contract.json` for the machine-readable contract.
