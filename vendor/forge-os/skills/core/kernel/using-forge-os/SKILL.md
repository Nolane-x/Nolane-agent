---
name: using-forge-os
description: "Use when using forge os is required during kernel work, especially when the result must be traceable, independently reviewable, and safe to hand to another agent."
license: MIT
compatibility: "ForgeOS-compatible Agent Skills hosts; no provider-specific model required."
metadata:
  author: forgeos-community
  version: "0.2.0"
  pack: kernel
  kind: core
  status: stable
---

# Using Forge Os

## Overview

This skill owns one bounded responsibility: **using forge os**. Its focus is route one project from confirmed intent to the next evidence-backed state without loading unrelated skills. It converts declared inputs into typed artifacts and reproducible evidence without silently changing product scope.

## Trigger

Activate only when the project is in one of these stages: `intent`, `discovery`, `research`, `divergence`, `synthesis`, `selection`, `product-definition`, `ux-design`, `architecture`, `planning`, `implementation`, `verification`, `release-readiness`, all contract preconditions pass, and the router identifies a missing output this skill can produce. Do not activate merely because the skill name resembles the user request.

## Required Inputs

- `project-state`
- `gate-state`
- Optional: `confirmed-intent`
- Current gate result, open findings, artifact hashes, and invalidation state
- Required tools: none
- Optional tools: none
- Confirmed human decisions relevant to this scope

## Method-Specific Protocol

1. Read only the project header, current gate, open findings, direct artifact hashes, and confirmed decisions.
2. Compute missing gate artifacts before selecting any skill.
3. Exclude skills with failed preconditions, unavailable tools, conflicts, quarantine status, or assurance mismatch.
4. Activate the smallest non-conflicting skill set that can close the current evidence gap.
5. Commit the route explanation, context budget, stop condition, and invalidation impact before dispatch.

## Procedure

1. Read the current project state and active gate.
2. Resolve only the minimum missing state required for routing.
3. Read only the project header, current gate, open findings, direct artifact hashes, and confirmed decisions.
4. Compute missing gate artifacts before selecting any skill.
5. Exclude skills with failed preconditions, unavailable tools, conflicts, quarantine status, or assurance mismatch.
6. Activate the smallest non-conflicting skill set that can close the current evidence gap.
7. Commit the route explanation, context budget, stop condition, and invalidation impact before dispatch.
8. Compile a bounded context pack from direct dependencies.
9. Execute the contracted operation without authoring unrelated artifacts.
10. Record decisions, provenance, and audit events.
11. Emit the next eligible skill set and stop condition.

## Skill Graph Router

1. Read project stage, domain, assurance profile, available tools, verified artifact hashes, active findings, and confirmed human decisions.
2. Load metadata only; do not preload every skill body.
3. Compute missing gate artifacts and hard-exclude quarantined, deprecated, conflicting, tool-incompatible, assurance-incompatible, and precondition-incomplete skills.
4. Rank eligible skills by state match, artifact need, domain fit, assurance fit, historical utility, and context cost.
5. Activate the smallest non-conflicting set that can produce the next gate-required evidence.
6. Persist inclusion and exclusion reasons, context estimate, invalidation impact, and stop condition.
7. Stop when the gate passes, a blocker is recorded, or a human decision is required.

## Artifact Handoff

Every handoff is a typed envelope containing artifact IDs, schema versions, content hashes, producing skill and agent, consumed artifacts, decision IDs, evidence IDs, residual risks, validation state, invalidation targets, and stop condition. Free-form summaries are supplemental and never the source of truth.

## Verification Questions

- Can every selected skill name a missing gate artifact?
- Would removing any selected skill leave the same gate achievable?
- Are human decisions and critical findings represented explicitly?
- Does the context pack omit unrelated history and full skill bodies?

## Evidence Packet

Produce or reference all applicable evidence:

- `route-decision.json`
- `context-pack manifest`
- `current gate snapshot`

Evidence must identify the current artifact hash, command or method used, result, reviewer identity, timestamp, and limitations.

## Output Contract

Produce:
- `routing-decision`

The primary artifact must include schema version, provenance, consumed artifact IDs, decisions, evidence references, residual risks, validation state, and invalidation targets. Narrative explanation may accompany the artifact but cannot replace it.

## Quality Gate

Reviewer: `independent-reviewer`

- The output directly and completely performs using forge os within its declared boundary.
- Can every selected skill name a missing gate artifact?
- Would removing any selected skill leave the same gate achievable?
- Are human decisions and critical findings represented explicitly?
- Does the context pack omit unrelated history and full skill bodies?
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
- loading every skill
- routing by keyword alone
- advancing a stage from conversational confidence

## Escalation and Invalidation

Stop and request a human decision when scope, risk acceptance, irreversible action, cost ceiling, privacy boundary, or product direction is materially ambiguous. When this artifact changes, invalidate only descendants named by the artifact graph; preserve unaffected verified branches.

## Handoff

- Next transition: the graph router selects a real consumer of `routing-decision`.
- Required evidence: `contract-validation`, `independent-review`, `route-decision.json`, `context-pack manifest`, `current gate snapshot`.
- Required envelope fields: `artifactId`, `schemaVersion`, `sha256`, `producingSkill`, `producingAgent`, `consumedArtifacts`, `decisionIds`, `evidenceIds`, `residualRisks`, `validationState`, `invalidationTargets`, `stopCondition`.
- Stop condition: Output contract is satisfied, a blocker is recorded, or a material human decision is required.

## Token and Context Policy

Load at most 8 direct artifacts and reference depth 1. Use stable IDs, hashes, signatures, and deltas instead of repeating full history. Use established domain terminology, state each requirement once, and spend context on decisions, code, tests, or evidence rather than narration.

## Reference Playbook

Load [skills/references/core/kernel.md](../../../references/core/kernel.md) only when this skill needs pack-wide decision tables, evidence patterns, or cross-skill handoff rules.

See `contract.json` for the machine-readable contract.
