---
name: designing-interactive-3d-experiences
description: "Use when designing interactive 3d experiences is required during interactive-3d product work, especially when the result must be traceable, independently reviewable, and safe to hand to another agent."
license: MIT
compatibility: "ForgeOS-compatible Agent Skills hosts; no provider-specific model required."
metadata:
  author: forgeos-community
  version: "0.2.0"
  pack: domain
  kind: domain
  status: candidate
---

# Designing Interactive 3d Experiences

## Overview

This skill owns one bounded responsibility: **designing interactive 3d experiences**. Its focus is design an interactive 3D experience with explicit runtime, input, accessibility, asset, and device constraints. It converts declared inputs into typed artifacts and reproducible evidence without silently changing product scope.

## Trigger

Activate only when the project is in one of these stages: `product-definition`, `ux-design`, `architecture`, `planning`, `implementation`, `verification`, `release-readiness`, all contract preconditions pass, and the router identifies a missing output this skill can produce. Do not activate merely because the skill name resembles the user request.

## Required Inputs

- `product-definition`
- Optional: `architecture-decision`
- Optional: `verified-build`
- Current gate result, open findings, artifact hashes, and invalidation state
- Required tools: none
- Optional tools: none
- Confirmed human decisions relevant to this scope

## Method-Specific Protocol

1. Define the user goal, interaction model, supported devices, input methods, comfort constraints, and a non-3D fallback.
2. Specify scene graph, coordinate conventions, asset provenance, level-of-detail policy, loading states, and interaction affordances.
3. Set measurable budgets for startup, frame time, memory, geometry, textures, draw calls, and network payload by target class.
4. Design navigation, focus, keyboard or assistive alternatives, motion reduction, camera behavior, and error recovery before implementation.
5. Deliver an experience contract, representative scene specification, budget table, fallback design, and assumptions requiring runtime validation.

## Procedure

1. Read the confirmed product definition, domain context, assurance profile, and active findings.
2. Identify the domain objects, actors, state transitions, regulations, provider boundaries, and operational constraints owned by this skill.
3. Define the user goal, interaction model, supported devices, input methods, comfort constraints, and a non-3D fallback.
4. Specify scene graph, coordinate conventions, asset provenance, level-of-detail policy, loading states, and interaction affordances.
5. Set measurable budgets for startup, frame time, memory, geometry, textures, draw calls, and network payload by target class.
6. Design navigation, focus, keyboard or assistive alternatives, motion reduction, camera behavior, and error recovery before implementation.
7. Deliver an experience contract, representative scene specification, budget table, fallback design, and assumptions requiring runtime validation.
8. Model normal, boundary, failure, recovery, permission, concurrency, migration, and abuse behavior before implementation.
9. Define stable contracts and explicit non-goals; do not leak domain concerns into unrelated modules.
10. Create executable acceptance, negative, resilience, and compatibility checks proportional to risk.
11. Publish the domain artifact, evidence packet, unresolved assumptions, and downstream invalidations.

## Verification Questions

- Is every primary task possible through the declared supported input methods?
- Do geometry, texture, startup, memory, and frame budgets name a target device class?
- Is there a usable fallback when WebGL, GPU, motion, or large assets are unavailable?
- Are source licenses and coordinate conventions recorded before assets are integrated?

## Evidence Packet

Produce or reference all applicable evidence:

- `interactive-3d experience contract`
- `scene and input specification`
- `performance budget table`
- `fallback and asset provenance review`

Evidence must identify the current artifact hash, command or method used, result, reviewer identity, timestamp, and limitations.

## Output Contract

Produce:
- `domain-blueprint`
- `domain-evidence`

The primary artifact must include schema version, provenance, consumed artifact IDs, decisions, evidence references, residual risks, validation state, and invalidation targets. Narrative explanation may accompany the artifact but cannot replace it.

## Quality Gate

Reviewer: `interactive-3d-reviewer`

- The output directly and completely performs designing interactive 3d experiences within its declared boundary.
- Is every primary task possible through the declared supported input methods?
- Do geometry, texture, startup, memory, and frame budgets name a target device class?
- Is there a usable fallback when WebGL, GPU, motion, or large assets are unavailable?
- Are source licenses and coordinate conventions recorded before assets are integrated?
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
- assuming a design file proves runtime performance
- requiring motion when a reduced-motion path is needed
- shipping unlicensed models or textures

## Escalation and Invalidation

Stop and request a human decision when scope, risk acceptance, irreversible action, cost ceiling, privacy boundary, or product direction is materially ambiguous. When this artifact changes, invalidate only descendants named by the artifact graph; preserve unaffected verified branches.

## Handoff

- Next transition: the graph router selects a real consumer of `domain-blueprint`, `domain-evidence`.
- Required evidence: `contract-validation`, `independent-review`, `interactive-3d experience contract`, `scene and input specification`, `performance budget table`, `fallback and asset provenance review`.
- Required envelope fields: `artifactId`, `schemaVersion`, `sha256`, `producingSkill`, `producingAgent`, `consumedArtifacts`, `decisionIds`, `evidenceIds`, `residualRisks`, `validationState`, `invalidationTargets`, `stopCondition`.
- Stop condition: Output contract is satisfied, a blocker is recorded, or a material human decision is required.

## Token and Context Policy

Load at most 8 direct artifacts and reference depth 1. Use stable IDs, hashes, signatures, and deltas instead of repeating full history. Use established domain terminology, state each requirement once, and spend context on decisions, code, tests, or evidence rather than narration.

## Reference Playbook

Load [skills/references/domains/interactive-3d.md](../../../references/domains/interactive-3d.md) only when this skill needs pack-wide decision tables, evidence patterns, or cross-skill handoff rules.

See `contract.json` for the machine-readable contract.
