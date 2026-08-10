---
name: generating-divergent-concepts
description: "Use when generating divergent concepts is required during creativity work, especially when the result must be traceable, independently reviewable, and safe to hand to another agent."
license: MIT
compatibility: "ForgeOS-compatible Agent Skills hosts; no provider-specific model required."
metadata:
  author: forgeos-community
  version: "0.2.0"
  pack: creativity
  kind: core
  status: stable
---

# Generating Divergent Concepts

## Overview

This skill owns one bounded responsibility: **generating divergent concepts**. Its focus is produce mechanism-distinct concepts while delaying cross-agent anchoring and selection. It converts declared inputs into typed artifacts and reproducible evidence without silently changing product scope.

## Trigger

Activate only when the project is in one of these stages: `divergence`, `synthesis`, all contract preconditions pass, and the router identifies a missing output this skill can produce. Do not activate merely because the skill name resembles the user request.

## Required Inputs

- `creative-brief`
- Current gate result, open findings, artifact hashes, and invalidation state
- Required tools: none
- Optional tools: none
- Confirmed human decisions relevant to this scope

## Method-Specific Protocol

1. Freeze the creative brief, forbidden defaults, resource limits, and evaluation frame.
2. Dispatch independent lenses that cannot see one another’s candidates during the first pass.
3. Require each candidate to specify user, hidden problem, trigger, mechanism, interface, incentive, distribution, assumptions, and cheapest experiment.
4. Force a second pass through inversion, removal, extreme constraints, and cross-domain mechanism transfer.
5. Cluster by mechanism and regenerate any region represented only by naming or feature variation.

## Procedure

1. Freeze the challenge, constraints, forbidden defaults, and evaluation frame.
2. Generate independent mechanism-level candidates before cross-contamination.
3. Freeze the creative brief, forbidden defaults, resource limits, and evaluation frame.
4. Dispatch independent lenses that cannot see one another’s candidates during the first pass.
5. Require each candidate to specify user, hidden problem, trigger, mechanism, interface, incentive, distribution, assumptions, and cheapest experiment.
6. Force a second pass through inversion, removal, extreme constraints, and cross-domain mechanism transfer.
7. Cluster by mechanism and regenerate any region represented only by naming or feature variation.
8. Apply the named divergence or mutation operation.
9. Represent candidates as structured idea genomes.
10. Remove semantic duplicates and fake novelty.
11. Hand off distinct candidates without selecting a winner prematurely.

## Verification Questions

- Do candidates differ in causal mechanism rather than wording?
- Did any candidate merely add AI, automation, or gamification?
- Were independent branches preserved before synthesis?
- Can every candidate be falsified cheaply?

## Evidence Packet

Produce or reference all applicable evidence:

- `idea genomes`
- `lens provenance`
- `semantic clusters`
- `forbidden-pattern report`

Evidence must identify the current artifact hash, command or method used, result, reviewer identity, timestamp, and limitations.

## Output Contract

Produce:
- `candidate-ideas`

The primary artifact must include schema version, provenance, consumed artifact IDs, decisions, evidence references, residual risks, validation state, and invalidation targets. Narrative explanation may accompany the artifact but cannot replace it.

## Quality Gate

Reviewer: `independent-reviewer`

- The output directly and completely performs generating divergent concepts within its declared boundary.
- Do candidates differ in causal mechanism rather than wording?
- Did any candidate merely add AI, automation, or gamification?
- Were independent branches preserved before synthesis?
- Can every candidate be falsified cheaply?
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
- brainstorming in one shared thread
- selecting during generation
- counting renamed variants as diversity

## Escalation and Invalidation

Stop and request a human decision when scope, risk acceptance, irreversible action, cost ceiling, privacy boundary, or product direction is materially ambiguous. When this artifact changes, invalidate only descendants named by the artifact graph; preserve unaffected verified branches.

## Handoff

- Next transition: the graph router selects a real consumer of `candidate-ideas`.
- Required evidence: `contract-validation`, `independent-review`, `idea genomes`, `lens provenance`, `semantic clusters`, `forbidden-pattern report`.
- Required envelope fields: `artifactId`, `schemaVersion`, `sha256`, `producingSkill`, `producingAgent`, `consumedArtifacts`, `decisionIds`, `evidenceIds`, `residualRisks`, `validationState`, `invalidationTargets`, `stopCondition`.
- Stop condition: Output contract is satisfied, a blocker is recorded, or a material human decision is required.

## Token and Context Policy

Load at most 8 direct artifacts and reference depth 1. Use stable IDs, hashes, signatures, and deltas instead of repeating full history. Use established domain terminology, state each requirement once, and spend context on decisions, code, tests, or evidence rather than narration.

## Reference Playbook

Load [skills/references/core/creativity.md](../../../references/core/creativity.md) only when this skill needs pack-wide decision tables, evidence patterns, or cross-skill handoff rules.

See `contract.json` for the machine-readable contract.
