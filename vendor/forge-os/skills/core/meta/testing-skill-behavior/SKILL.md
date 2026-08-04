---
name: testing-skill-behavior
description: "Use when testing skill behavior is required during meta work, especially when the result must be traceable, independently reviewable, and safe to hand to another agent."
license: MIT
compatibility: "ForgeOS-compatible Agent Skills hosts; no provider-specific model required."
metadata:
  author: forgeos-community
  version: "0.2.0"
  pack: meta
  kind: core
  status: stable
---

# Testing Skill Behavior

## Overview

This skill owns one bounded responsibility: **testing skill behavior**. Its focus is prove that a skill changes agent behavior under realistic pressure rather than merely sounding persuasive. It converts declared inputs into typed artifacts and reproducible evidence without silently changing product scope.

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

1. Create a baseline scenario that exposes the target failure without the skill.
2. Record the agent’s exact choices, omissions, and rationalizations.
3. Add the smallest skill guidance that targets the observed failure form.
4. Repeat across task variations, pressure combinations, models, and context sizes.
5. Measure compliance, output quality, task success, token cost, and new failure modes before promotion.

## Procedure

1. Identify the measured agent failure or capability gap.
2. Write a baseline scenario that exposes the gap without the candidate skill.
3. Create a baseline scenario that exposes the target failure without the skill.
4. Record the agent’s exact choices, omissions, and rationalizations.
5. Add the smallest skill guidance that targets the observed failure form.
6. Repeat across task variations, pressure combinations, models, and context sizes.
7. Measure compliance, output quality, task success, token cost, and new failure modes before promotion.
8. Design the smallest skill or adapter change that targets the failure.
9. Run paired behavioral evaluations across representative agents.
10. Measure success, quality, context, cost, and new failure modes.
11. Promote, revise, deprecate, or quarantine based on evidence.

## Verification Questions

- Was a failing baseline observed?
- Does the skill improve behavior beyond one prompt seed?
- Does it create a new regression or context burden?
- Can an agent recognize when the skill should not apply?

## Evidence Packet

Produce or reference all applicable evidence:

- `baseline transcripts`
- `candidate transcripts`
- `scored comparison`
- `rationalization catalog`

Evidence must identify the current artifact hash, command or method used, result, reviewer identity, timestamp, and limitations.

## Output Contract

Produce:
- `skill-evaluation`

The primary artifact must include schema version, provenance, consumed artifact IDs, decisions, evidence references, residual risks, validation state, and invalidation targets. Narrative explanation may accompany the artifact but cannot replace it.

## Quality Gate

Reviewer: `independent-reviewer`

- The output directly and completely performs testing skill behavior within its declared boundary.
- Was a failing baseline observed?
- Does the skill improve behavior beyond one prompt seed?
- Does it create a new regression or context burden?
- Can an agent recognize when the skill should not apply?
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
- testing only comprehension
- editing the skill during the candidate run
- promoting from one success

## Escalation and Invalidation

Stop and request a human decision when scope, risk acceptance, irreversible action, cost ceiling, privacy boundary, or product direction is materially ambiguous. When this artifact changes, invalidate only descendants named by the artifact graph; preserve unaffected verified branches.

## Handoff

- Next transition: the graph router selects a real consumer of `skill-evaluation`.
- Required evidence: `contract-validation`, `independent-review`, `baseline transcripts`, `candidate transcripts`, `scored comparison`, `rationalization catalog`.
- Required envelope fields: `artifactId`, `schemaVersion`, `sha256`, `producingSkill`, `producingAgent`, `consumedArtifacts`, `decisionIds`, `evidenceIds`, `residualRisks`, `validationState`, `invalidationTargets`, `stopCondition`.
- Stop condition: Output contract is satisfied, a blocker is recorded, or a material human decision is required.

## Token and Context Policy

Load at most 8 direct artifacts and reference depth 1. Use stable IDs, hashes, signatures, and deltas instead of repeating full history. Use established domain terminology, state each requirement once, and spend context on decisions, code, tests, or evidence rather than narration.

## Reference Playbook

Load [skills/references/core/meta.md](../../../references/core/meta.md) only when this skill needs pack-wide decision tables, evidence patterns, or cross-skill handoff rules.

See `contract.json` for the machine-readable contract.
