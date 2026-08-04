---
name: packaging-release-evidence
description: "Use when packaging release evidence is required during operations work, especially when the result must be traceable, independently reviewable, and safe to hand to another agent."
license: MIT
compatibility: "ForgeOS-compatible Agent Skills hosts; no provider-specific model required."
metadata:
  author: forgeos-community
  version: "0.2.0"
  pack: operations
  kind: core
  status: stable
---

# Packaging Release Evidence

## Overview

This skill owns one bounded responsibility: **packaging release evidence**. Its focus is assemble a reproducible release dossier linking requirements, build identity, tests, findings, migrations, rollback, and residual risks. It converts declared inputs into typed artifacts and reproducible evidence without silently changing product scope.

## Trigger

Activate only when the project is in one of these stages: `implementation`, `verification`, `release-readiness`, `released`, all contract preconditions pass, and the router identifies a missing output this skill can produce. Do not activate merely because the skill name resembles the user request.

## Required Inputs

- `verification-report`
- `security-review`
- `operations-evidence`
- Optional: `security-release-decision`
- Optional: `deployment-plan`
- Optional: `ux-evidence`
- Current gate result, open findings, artifact hashes, and invalidation state
- Required tools: none
- Optional tools: `shell`, `container-runtime`
- Confirmed human decisions relevant to this scope

## Method-Specific Protocol

1. Freeze the release candidate and record source, dependency, build, and artifact hashes.
2. Collect requirement traceability, test logs, coverage, mutation, fuzz, security, UX, performance, compatibility, migration, and rollback evidence required by assurance.
3. Verify evidence freshness and that every report targets the frozen candidate.
4. List unresolved findings and exact human acceptances without summarizing them away.
5. Generate a machine-readable dossier plus a concise human release decision.

## Procedure

1. Read deployment topology, service objectives, and rollback constraints.
2. Define observable success and failure signals.
3. Freeze the release candidate and record source, dependency, build, and artifact hashes.
4. Collect requirement traceability, test logs, coverage, mutation, fuzz, security, UX, performance, compatibility, migration, and rollback evidence required by assurance.
5. Verify evidence freshness and that every report targets the frozen candidate.
6. List unresolved findings and exact human acceptances without summarizing them away.
7. Generate a machine-readable dossier plus a concise human release decision.
8. Rehearse the operational change in a controlled environment.
9. Verify monitoring, alerting, rollback, and incident ownership.
10. Capture production-safe evidence and residual risks.
11. Publish an operations artifact with explicit go/no-go criteria.

## Verification Questions

- Can another reviewer reproduce each verification command?
- Do screenshots and logs identify the tested version?
- Are missing evidence and skipped controls explicit?
- Does the dossier distinguish tested claims from assumptions?

## Evidence Packet

Produce or reference all applicable evidence:

- `release dossier`
- `hash manifest`
- `traceability matrix`
- `known-risk register`

Evidence must identify the current artifact hash, command or method used, result, reviewer identity, timestamp, and limitations.

## Output Contract

Produce:
- `release-dossier`

The primary artifact must include schema version, provenance, consumed artifact IDs, decisions, evidence references, residual risks, validation state, and invalidation targets. Narrative explanation may accompany the artifact but cannot replace it.

## Quality Gate

Reviewer: `independent-reviewer`

- The output directly and completely performs packaging release evidence within its declared boundary.
- Can another reviewer reproduce each verification command?
- Do screenshots and logs identify the tested version?
- Are missing evidence and skipped controls explicit?
- Does the dossier distinguish tested claims from assumptions?
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
- copying CI badges
- mixing evidence from different commits
- claiming defect-free software

## Escalation and Invalidation

Stop and request a human decision when scope, risk acceptance, irreversible action, cost ceiling, privacy boundary, or product direction is materially ambiguous. When this artifact changes, invalidate only descendants named by the artifact graph; preserve unaffected verified branches.

## Handoff

- Next transition: the graph router selects a real consumer of `release-dossier`.
- Required evidence: `contract-validation`, `independent-review`, `release dossier`, `hash manifest`, `traceability matrix`, `known-risk register`.
- Required envelope fields: `artifactId`, `schemaVersion`, `sha256`, `producingSkill`, `producingAgent`, `consumedArtifacts`, `decisionIds`, `evidenceIds`, `residualRisks`, `validationState`, `invalidationTargets`, `stopCondition`.
- Stop condition: Output contract is satisfied, a blocker is recorded, or a material human decision is required.

## Token and Context Policy

Load at most 8 direct artifacts and reference depth 1. Use stable IDs, hashes, signatures, and deltas instead of repeating full history. Use established domain terminology, state each requirement once, and spend context on decisions, code, tests, or evidence rather than narration.

## Reference Playbook

Load [skills/references/core/operations.md](../../../references/core/operations.md) only when this skill needs pack-wide decision tables, evidence patterns, or cross-skill handoff rules.

See `contract.json` for the machine-readable contract.
