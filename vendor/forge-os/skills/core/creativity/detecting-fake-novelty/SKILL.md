---
name: detecting-fake-novelty
description: "Use when detecting fake novelty is required during creativity work, especially when the result must be traceable, independently reviewable, and safe to hand to another agent."
license: MIT
compatibility: "ForgeOS-compatible Agent Skills hosts; no provider-specific model required."
metadata:
  author: forgeos-community
  version: "0.2.0"
  pack: creativity
  kind: core
  status: stable
---

# Detecting Fake Novelty

## Overview

This skill owns one bounded responsibility: **detecting fake novelty**. Its focus is distinguish new causal mechanisms from renamed, bundled, randomized, or AI-decorated existing patterns. It converts declared inputs into typed artifacts and reproducible evidence without silently changing product scope.

## Trigger

Activate only when the project is in one of these stages: `divergence`, `synthesis`, all contract preconditions pass, and the router identifies a missing output this skill can produce. Do not activate merely because the skill name resembles the user request.

## Required Inputs

- `candidate-ideas`
- Current gate result, open findings, artifact hashes, and invalidation state
- Required tools: none
- Optional tools: none
- Confirmed human decisions relevant to this scope

## Method-Specific Protocol

1. Identify the closest existing product or system pattern.
2. Reduce both candidate and comparator to target, mechanism, interface, incentive, distribution, and ownership.
3. Count meaningful axis differences and identify dependencies on existing mechanisms.
4. Search prior art only after the unconstrained generation pass to avoid premature anchoring.
5. Classify novelty as surface, configuration, mechanism, system, or problem-reframing.

## Procedure

1. Freeze the challenge, constraints, forbidden defaults, and evaluation frame.
2. Generate independent mechanism-level candidates before cross-contamination.
3. Identify the closest existing product or system pattern.
4. Reduce both candidate and comparator to target, mechanism, interface, incentive, distribution, and ownership.
5. Count meaningful axis differences and identify dependencies on existing mechanisms.
6. Search prior art only after the unconstrained generation pass to avoid premature anchoring.
7. Classify novelty as surface, configuration, mechanism, system, or problem-reframing.
8. Apply the named divergence or mutation operation.
9. Represent candidates as structured idea genomes.
10. Remove semantic duplicates and fake novelty.
11. Hand off distinct candidates without selecting a winner prematurely.

## Verification Questions

- Would the concept still be new without its name and branding?
- Is adding an LLM the only difference?
- Are at least three material axes different?
- Is the novelty claim bounded to the evidence searched?

## Evidence Packet

Produce or reference all applicable evidence:

- `closest-pattern analysis`
- `difference matrix`
- `prior-art map`
- `novelty classification`

Evidence must identify the current artifact hash, command or method used, result, reviewer identity, timestamp, and limitations.

## Output Contract

Produce:
- `scored-ideas`

The primary artifact must include schema version, provenance, consumed artifact IDs, decisions, evidence references, residual risks, validation state, and invalidation targets. Narrative explanation may accompany the artifact but cannot replace it.

## Quality Gate

Reviewer: `independent-reviewer`

- The output directly and completely performs detecting fake novelty within its declared boundary.
- Would the concept still be new without its name and branding?
- Is adding an LLM the only difference?
- Are at least three material axes different?
- Is the novelty claim bounded to the evidence searched?
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
- claiming “never done before”
- equating rarity with usefulness
- rewarding random combinations

## Escalation and Invalidation

Stop and request a human decision when scope, risk acceptance, irreversible action, cost ceiling, privacy boundary, or product direction is materially ambiguous. When this artifact changes, invalidate only descendants named by the artifact graph; preserve unaffected verified branches.

## Handoff

- Next transition: the graph router selects a real consumer of `scored-ideas`.
- Required evidence: `contract-validation`, `independent-review`, `closest-pattern analysis`, `difference matrix`, `prior-art map`, `novelty classification`.
- Required envelope fields: `artifactId`, `schemaVersion`, `sha256`, `producingSkill`, `producingAgent`, `consumedArtifacts`, `decisionIds`, `evidenceIds`, `residualRisks`, `validationState`, `invalidationTargets`, `stopCondition`.
- Stop condition: Output contract is satisfied, a blocker is recorded, or a material human decision is required.

## Token and Context Policy

Load at most 8 direct artifacts and reference depth 1. Use stable IDs, hashes, signatures, and deltas instead of repeating full history. Use established domain terminology, state each requirement once, and spend context on decisions, code, tests, or evidence rather than narration.

## Reference Playbook

Load [skills/references/core/creativity.md](../../../references/core/creativity.md) only when this skill needs pack-wide decision tables, evidence patterns, or cross-skill handoff rules.

See `contract.json` for the machine-readable contract.
