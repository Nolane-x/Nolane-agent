---
name: validating-visual-asset-delivery
description: "Use when validating visual asset delivery is required during visual-design product work, especially when the result must be traceable, independently reviewable, and safe to hand to another agent."
license: MIT
compatibility: "ForgeOS-compatible Agent Skills hosts; no provider-specific model required."
metadata:
  author: forgeos-community
  version: "0.2.0"
  pack: domain
  kind: domain
  status: candidate
---

# Validating Visual Asset Delivery

## Overview

This skill owns one bounded responsibility: **validating visual asset delivery**. Its focus is verify that a visual asset package is usable, attributable, accessible, and matched to its declared delivery surface. It converts declared inputs into typed artifacts and reproducible evidence without silently changing product scope.

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

1. Inventory every asset with owner, source, license or permission, intended surface, dimensions, color profile, and format.
2. Validate filenames, dimensions, density variants, transparency, safe areas, compression, and fallback behavior against the delivery contract.
3. Check legibility at representative sizes, alt-text or transcript ownership, localization needs, and dark or high-contrast compatibility.
4. Open the exported files in an independent viewer and compare a sample against the source specification without claiming device certification.
5. Publish a manifest of pass, fail, exception, replacement, and unresolved-rights evidence for human release review.

## Procedure

1. Read the confirmed product definition, domain context, assurance profile, and active findings.
2. Identify the domain objects, actors, state transitions, regulations, provider boundaries, and operational constraints owned by this skill.
3. Inventory every asset with owner, source, license or permission, intended surface, dimensions, color profile, and format.
4. Validate filenames, dimensions, density variants, transparency, safe areas, compression, and fallback behavior against the delivery contract.
5. Check legibility at representative sizes, alt-text or transcript ownership, localization needs, and dark or high-contrast compatibility.
6. Open the exported files in an independent viewer and compare a sample against the source specification without claiming device certification.
7. Publish a manifest of pass, fail, exception, replacement, and unresolved-rights evidence for human release review.
8. Model normal, boundary, failure, recovery, permission, concurrency, migration, and abuse behavior before implementation.
9. Define stable contracts and explicit non-goals; do not leak domain concerns into unrelated modules.
10. Create executable acceptance, negative, resilience, and compatibility checks proportional to risk.
11. Publish the domain artifact, evidence packet, unresolved assumptions, and downstream invalidations.

## Verification Questions

- Does each asset have a known source and permitted use?
- Can the declared target surface render the supplied format and dimensions?
- Are critical messages available as text, caption, or alternative description?
- Is a successful file-open check kept distinct from production device certification?

## Evidence Packet

Produce or reference all applicable evidence:

- `asset manifest`
- `format and dimension checks`
- `independent viewer record`
- `license and accessibility review`

Evidence must identify the current artifact hash, command or method used, result, reviewer identity, timestamp, and limitations.

## Output Contract

Produce:
- `domain-blueprint`
- `domain-evidence`

The primary artifact must include schema version, provenance, consumed artifact IDs, decisions, evidence references, residual risks, validation state, and invalidation targets. Narrative explanation may accompany the artifact but cannot replace it.

## Quality Gate

Reviewer: `visual-design-reviewer`

- The output directly and completely performs validating visual asset delivery within its declared boundary.
- Does each asset have a known source and permitted use?
- Can the declared target surface render the supplied format and dimensions?
- Are critical messages available as text, caption, or alternative description?
- Is a successful file-open check kept distinct from production device certification?
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
- assuming an export is licensed because it was downloadable
- shipping only a high-resolution master
- calling a local preview a production compatibility guarantee

## Escalation and Invalidation

Stop and request a human decision when scope, risk acceptance, irreversible action, cost ceiling, privacy boundary, or product direction is materially ambiguous. When this artifact changes, invalidate only descendants named by the artifact graph; preserve unaffected verified branches.

## Handoff

- Next transition: the graph router selects a real consumer of `domain-blueprint`, `domain-evidence`.
- Required evidence: `contract-validation`, `independent-review`, `asset manifest`, `format and dimension checks`, `independent viewer record`, `license and accessibility review`.
- Required envelope fields: `artifactId`, `schemaVersion`, `sha256`, `producingSkill`, `producingAgent`, `consumedArtifacts`, `decisionIds`, `evidenceIds`, `residualRisks`, `validationState`, `invalidationTargets`, `stopCondition`.
- Stop condition: Output contract is satisfied, a blocker is recorded, or a material human decision is required.

## Token and Context Policy

Load at most 8 direct artifacts and reference depth 1. Use stable IDs, hashes, signatures, and deltas instead of repeating full history. Use established domain terminology, state each requirement once, and spend context on decisions, code, tests, or evidence rather than narration.

## Reference Playbook

Load [skills/references/domains/visual-design.md](../../../references/domains/visual-design.md) only when this skill needs pack-wide decision tables, evidence patterns, or cross-skill handoff rules.

See `contract.json` for the machine-readable contract.
