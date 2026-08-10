---
name: validating-physical-product-safety
description: "Use when validating physical product safety is required during physical-products product work, especially when the result must be traceable, independently reviewable, and safe to hand to another agent."
license: MIT
compatibility: "ForgeOS-compatible Agent Skills hosts; no provider-specific model required."
metadata:
  author: forgeos-community
  version: "0.2.0"
  pack: domain
  kind: domain
  status: candidate
---

# Validating Physical Product Safety

## Overview

This skill owns one bounded responsibility: **validating physical product safety**. Its focus is build a safety evidence plan for a physical product while keeping certification and real-world testing under qualified human authority. It converts declared inputs into typed artifacts and reproducible evidence without silently changing product scope.

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

1. Identify users, environments, foreseeable misuse, energy sources, hazardous states, applicable jurisdictions, and the safety owner.
2. Perform documented hazard analysis with severity, likelihood, controls, residual risk, safe-state behavior, warnings, and verification method.
3. Define traceable safety requirements, design controls, inspection points, emergency behavior, change-control rules, and incident reporting.
4. Plan prototype, laboratory, environmental, abuse, and failure-mode tests with qualified personnel, equipment, stopping criteria, and records.
5. Produce a review packet that distinguishes planned evidence, observed evidence, unresolved hazards, and any required legal or certification path.

## Procedure

1. Read the confirmed product definition, domain context, assurance profile, and active findings.
2. Identify the domain objects, actors, state transitions, regulations, provider boundaries, and operational constraints owned by this skill.
3. Identify users, environments, foreseeable misuse, energy sources, hazardous states, applicable jurisdictions, and the safety owner.
4. Perform documented hazard analysis with severity, likelihood, controls, residual risk, safe-state behavior, warnings, and verification method.
5. Define traceable safety requirements, design controls, inspection points, emergency behavior, change-control rules, and incident reporting.
6. Plan prototype, laboratory, environmental, abuse, and failure-mode tests with qualified personnel, equipment, stopping criteria, and records.
7. Produce a review packet that distinguishes planned evidence, observed evidence, unresolved hazards, and any required legal or certification path.
8. Model normal, boundary, failure, recovery, permission, concurrency, migration, and abuse behavior before implementation.
9. Define stable contracts and explicit non-goals; do not leak domain concerns into unrelated modules.
10. Create executable acceptance, negative, resilience, and compatibility checks proportional to risk.
11. Publish the domain artifact, evidence packet, unresolved assumptions, and downstream invalidations.

## Verification Questions

- Does every material hazard have an owner, control, residual-risk decision, and verification method?
- Are legal, certification, and laboratory claims explicitly withheld until qualified evidence exists?
- Do test plans include safe stopping conditions and incident handling?
- Can a reviewer trace each safety requirement to a test, inspection, or justified exception?

## Evidence Packet

Produce or reference all applicable evidence:

- `hazard analysis`
- `safety requirements trace`
- `qualified test plan`
- `residual-risk review`

Evidence must identify the current artifact hash, command or method used, result, reviewer identity, timestamp, and limitations.

## Output Contract

Produce:
- `domain-blueprint`
- `domain-evidence`

The primary artifact must include schema version, provenance, consumed artifact IDs, decisions, evidence references, residual risks, validation state, and invalidation targets. Narrative explanation may accompany the artifact but cannot replace it.

## Quality Gate

Reviewer: `physical-products-reviewer`

- The output directly and completely performs validating physical product safety within its declared boundary.
- Does every material hazard have an owner, control, residual-risk decision, and verification method?
- Are legal, certification, and laboratory claims explicitly withheld until qualified evidence exists?
- Do test plans include safe stopping conditions and incident handling?
- Can a reviewer trace each safety requirement to a test, inspection, or justified exception?
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
- claiming certification from a checklist
- testing hazardous systems without qualified supervision
- treating warnings as a substitute for an engineered control

## Escalation and Invalidation

Stop and request a human decision when scope, risk acceptance, irreversible action, cost ceiling, privacy boundary, or product direction is materially ambiguous. When this artifact changes, invalidate only descendants named by the artifact graph; preserve unaffected verified branches.

## Handoff

- Next transition: the graph router selects a real consumer of `domain-blueprint`, `domain-evidence`.
- Required evidence: `contract-validation`, `independent-review`, `hazard analysis`, `safety requirements trace`, `qualified test plan`, `residual-risk review`.
- Required envelope fields: `artifactId`, `schemaVersion`, `sha256`, `producingSkill`, `producingAgent`, `consumedArtifacts`, `decisionIds`, `evidenceIds`, `residualRisks`, `validationState`, `invalidationTargets`, `stopCondition`.
- Stop condition: Output contract is satisfied, a blocker is recorded, or a material human decision is required.

## Token and Context Policy

Load at most 8 direct artifacts and reference depth 1. Use stable IDs, hashes, signatures, and deltas instead of repeating full history. Use established domain terminology, state each requirement once, and spend context on decisions, code, tests, or evidence rather than narration.

## Reference Playbook

Load [skills/references/domains/physical-products.md](../../../references/domains/physical-products.md) only when this skill needs pack-wide decision tables, evidence patterns, or cross-skill handoff rules.

See `contract.json` for the machine-readable contract.
