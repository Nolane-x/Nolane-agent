---
name: designing-simulation-to-reality-workflows
description: "Use when designing simulation to reality workflows is required during physical-ai product work, especially when the result must be traceable, independently reviewable, and safe to hand to another agent."
license: MIT
compatibility: "ForgeOS-compatible Agent Skills hosts; no provider-specific model required."
metadata:
  author: forgeos-community
  version: "0.2.0"
  pack: domain
  kind: domain
  status: candidate
---

# Designing Simulation To Reality Workflows

## Overview

This skill owns one bounded responsibility: **designing simulation to reality workflows**. Its focus is plan a staged simulation-to-reality workflow with calibrated assumptions, rollback, and human authority before any live actuation. It converts declared inputs into typed artifacts and reproducible evidence without silently changing product scope.

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

1. Define the system boundary, task envelope, operating environment, actuator and sensor authority, hazards, and prohibited actions.
2. Record coordinate frames, units, calibration method, model provenance, sensor noise, latency, contact assumptions, and known simulation gaps.
3. Set acceptance metrics and a staged path from offline analysis to simulation, hardware-in-the-loop, supervised dry run, and separately authorized deployment.
4. Specify safety envelope, command limits, freshness checks, emergency stop ownership, communication-loss behavior, observation, logging, and rollback.
5. Deliver a sim-to-real gap register, calibration protocol, staged test plan, evidence requirements, and named human approvals for each transition.

## Procedure

1. Read the confirmed product definition, domain context, assurance profile, and active findings.
2. Identify the domain objects, actors, state transitions, regulations, provider boundaries, and operational constraints owned by this skill.
3. Define the system boundary, task envelope, operating environment, actuator and sensor authority, hazards, and prohibited actions.
4. Record coordinate frames, units, calibration method, model provenance, sensor noise, latency, contact assumptions, and known simulation gaps.
5. Set acceptance metrics and a staged path from offline analysis to simulation, hardware-in-the-loop, supervised dry run, and separately authorized deployment.
6. Specify safety envelope, command limits, freshness checks, emergency stop ownership, communication-loss behavior, observation, logging, and rollback.
7. Deliver a sim-to-real gap register, calibration protocol, staged test plan, evidence requirements, and named human approvals for each transition.
8. Model normal, boundary, failure, recovery, permission, concurrency, migration, and abuse behavior before implementation.
9. Define stable contracts and explicit non-goals; do not leak domain concerns into unrelated modules.
10. Create executable acceptance, negative, resilience, and compatibility checks proportional to risk.
11. Publish the domain artifact, evidence packet, unresolved assumptions, and downstream invalidations.

## Verification Questions

- Are simulation assumptions, coordinate frames, calibration, noise, latency, and unmodeled effects explicit?
- Does every stage have measurable entry criteria, stop conditions, and a rollback owner?
- Can the system fail to a safe state on stale sensing, communication loss, or out-of-envelope commands?
- Does the artifact prohibit live actuation unless a separately authorized executor and human controller are present?

## Evidence Packet

Produce or reference all applicable evidence:

- `sim-to-real gap register`
- `calibration protocol`
- `staged acceptance plan`
- `safety and rollback design`

Evidence must identify the current artifact hash, command or method used, result, reviewer identity, timestamp, and limitations.

## Output Contract

Produce:
- `domain-blueprint`
- `domain-evidence`

The primary artifact must include schema version, provenance, consumed artifact IDs, decisions, evidence references, residual risks, validation state, and invalidation targets. Narrative explanation may accompany the artifact but cannot replace it.

## Quality Gate

Reviewer: `physical-ai-reviewer`

- The output directly and completely performs designing simulation to reality workflows within its declared boundary.
- Are simulation assumptions, coordinate frames, calibration, noise, latency, and unmodeled effects explicit?
- Does every stage have measurable entry criteria, stop conditions, and a rollback owner?
- Can the system fail to a safe state on stale sensing, communication loss, or out-of-envelope commands?
- Does the artifact prohibit live actuation unless a separately authorized executor and human controller are present?
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
- treating simulator success as deployment evidence
- mixing coordinate frames or units
- allowing an agent plan to actuate hardware directly

## Escalation and Invalidation

Stop and request a human decision when scope, risk acceptance, irreversible action, cost ceiling, privacy boundary, or product direction is materially ambiguous. When this artifact changes, invalidate only descendants named by the artifact graph; preserve unaffected verified branches.

## Handoff

- Next transition: the graph router selects a real consumer of `domain-blueprint`, `domain-evidence`.
- Required evidence: `contract-validation`, `independent-review`, `sim-to-real gap register`, `calibration protocol`, `staged acceptance plan`, `safety and rollback design`.
- Required envelope fields: `artifactId`, `schemaVersion`, `sha256`, `producingSkill`, `producingAgent`, `consumedArtifacts`, `decisionIds`, `evidenceIds`, `residualRisks`, `validationState`, `invalidationTargets`, `stopCondition`.
- Stop condition: Output contract is satisfied, a blocker is recorded, or a material human decision is required.

## Token and Context Policy

Load at most 8 direct artifacts and reference depth 1. Use stable IDs, hashes, signatures, and deltas instead of repeating full history. Use established domain terminology, state each requirement once, and spend context on decisions, code, tests, or evidence rather than narration.

## Reference Playbook

Load [skills/references/domains/physical-ai.md](../../../references/domains/physical-ai.md) only when this skill needs pack-wide decision tables, evidence patterns, or cross-skill handoff rules.

See `contract.json` for the machine-readable contract.
