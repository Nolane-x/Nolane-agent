---
name: testing-physical-ai-deployment-boundaries
description: "Use when testing physical ai deployment boundaries is required during physical-ai product work, especially when the result must be traceable, independently reviewable, and safe to hand to another agent."
license: MIT
compatibility: "ForgeOS-compatible Agent Skills hosts; no provider-specific model required."
metadata:
  author: forgeos-community
  version: "0.2.0"
  pack: domain
  kind: domain
  status: candidate
---

# Testing Physical Ai Deployment Boundaries

## Overview

This skill owns one bounded responsibility: **testing physical ai deployment boundaries**. Its focus is verify physical-AI deployment boundaries through controlled evidence, without granting an agent authority to operate live equipment. It converts declared inputs into typed artifacts and reproducible evidence without silently changing product scope.

## Trigger

Activate only when the project is in one of these stages: `product-definition`, `ux-design`, `architecture`, `planning`, `implementation`, `verification`, `release-readiness`, all contract preconditions pass, and the router identifies a missing output this skill can produce. Do not activate merely because the skill name resembles the user request.

## Required Inputs

- `product-definition`
- Optional: `architecture-decision`
- Optional: `verified-build`
- Current gate result, open findings, artifact hashes, and invalidation state
- Required tools: none
- Optional tools: `test-runner`
- Confirmed human decisions relevant to this scope

## Method-Specific Protocol

1. Freeze software, model, policy, configuration, hardware revision, calibration state, safety envelope, operator, and test environment identity.
2. Exercise simulated or qualified supervised scenarios for normal operation, out-of-envelope requests, stale sensors, communication loss, actuator limits, and emergency stop.
3. Record command intent, policy decision, safety interlock response, observation timestamps, intervention, outcome, and evidence integrity for each run.
4. Compare observed behavior with declared limits and classify each result as pass, fail, blocked, or untested without inferring field reliability.
5. Publish a release-boundary report with replayable inputs where safe, unresolved risks, rollback procedure, human authorization requirements, and prohibited autonomous actions.

## Procedure

1. Read the confirmed product definition, domain context, assurance profile, and active findings.
2. Identify the domain objects, actors, state transitions, regulations, provider boundaries, and operational constraints owned by this skill.
3. Freeze software, model, policy, configuration, hardware revision, calibration state, safety envelope, operator, and test environment identity.
4. Exercise simulated or qualified supervised scenarios for normal operation, out-of-envelope requests, stale sensors, communication loss, actuator limits, and emergency stop.
5. Record command intent, policy decision, safety interlock response, observation timestamps, intervention, outcome, and evidence integrity for each run.
6. Compare observed behavior with declared limits and classify each result as pass, fail, blocked, or untested without inferring field reliability.
7. Publish a release-boundary report with replayable inputs where safe, unresolved risks, rollback procedure, human authorization requirements, and prohibited autonomous actions.
8. Model normal, boundary, failure, recovery, permission, concurrency, migration, and abuse behavior before implementation.
9. Define stable contracts and explicit non-goals; do not leak domain concerns into unrelated modules.
10. Create executable acceptance, negative, resilience, and compatibility checks proportional to risk.
11. Publish the domain artifact, evidence packet, unresolved assumptions, and downstream invalidations.

## Verification Questions

- Can evidence tie each test to a specific build, configuration, calibration, operator, and environment?
- Were unsafe commands, stale inputs, communication loss, and emergency stop behavior deliberately tested under safe supervision?
- Does a failed or untested case block the relevant deployment claim?
- Does the report preserve human authority and forbid direct live control by this skill?

## Evidence Packet

Produce or reference all applicable evidence:

- `physical-AI boundary report`
- `interlock and emergency-stop record`
- `controlled scenario log`
- `rollback and authorization register`

Evidence must identify the current artifact hash, command or method used, result, reviewer identity, timestamp, and limitations.

## Output Contract

Produce:
- `domain-blueprint`
- `domain-evidence`

The primary artifact must include schema version, provenance, consumed artifact IDs, decisions, evidence references, residual risks, validation state, and invalidation targets. Narrative explanation may accompany the artifact but cannot replace it.

## Quality Gate

Reviewer: `physical-ai-reviewer`

- The output directly and completely performs testing physical ai deployment boundaries within its declared boundary.
- Can evidence tie each test to a specific build, configuration, calibration, operator, and environment?
- Were unsafe commands, stale inputs, communication loss, and emergency stop behavior deliberately tested under safe supervision?
- Does a failed or untested case block the relevant deployment claim?
- Does the report preserve human authority and forbid direct live control by this skill?
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
- calling simulation-only checks field validation
- suppressing operator intervention from evidence
- allowing a test harness to become an unreviewed live controller

## Escalation and Invalidation

Stop and request a human decision when scope, risk acceptance, irreversible action, cost ceiling, privacy boundary, or product direction is materially ambiguous. When this artifact changes, invalidate only descendants named by the artifact graph; preserve unaffected verified branches.

## Handoff

- Next transition: the graph router selects a real consumer of `domain-blueprint`, `domain-evidence`.
- Required evidence: `contract-validation`, `independent-review`, `physical-AI boundary report`, `interlock and emergency-stop record`, `controlled scenario log`, `rollback and authorization register`.
- Required envelope fields: `artifactId`, `schemaVersion`, `sha256`, `producingSkill`, `producingAgent`, `consumedArtifacts`, `decisionIds`, `evidenceIds`, `residualRisks`, `validationState`, `invalidationTargets`, `stopCondition`.
- Stop condition: Output contract is satisfied, a blocker is recorded, or a material human decision is required.

## Token and Context Policy

Load at most 8 direct artifacts and reference depth 1. Use stable IDs, hashes, signatures, and deltas instead of repeating full history. Use established domain terminology, state each requirement once, and spend context on decisions, code, tests, or evidence rather than narration.

## Reference Playbook

Load [skills/references/domains/physical-ai.md](../../../references/domains/physical-ai.md) only when this skill needs pack-wide decision tables, evidence patterns, or cross-skill handoff rules.

See `contract.json` for the machine-readable contract.
