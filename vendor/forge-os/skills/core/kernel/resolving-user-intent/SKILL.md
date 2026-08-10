---
name: resolving-user-intent
description: "Use when resolving user intent is required during kernel work, especially when the result must be traceable, independently reviewable, and safe to hand to another agent."
license: MIT
compatibility: "ForgeOS-compatible Agent Skills hosts; no provider-specific model required."
metadata:
  author: forgeos-community
  version: "0.2.0"
  pack: kernel
  kind: core
  status: stable
---

# Resolving User Intent

## Overview

This skill owns one bounded responsibility: **resolving user intent**. Its focus is convert ambiguous product language into explicit goals, users, constraints, non-goals, success measures, and decision ownership. It converts declared inputs into typed artifacts and reproducible evidence without silently changing product scope.

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

1. Separate stated facts from model interpretations and unresolved questions.
2. Classify missing information by materiality: blocking, important, or safely deferrable.
3. Ask one decision-sized question at a time and prefer bounded choices when they preserve intent.
4. Reflect the answer back as a change to the intent artifact rather than as chat memory.
5. Request explicit confirmation only after contradictions and hidden assumptions are exposed.

## Procedure

1. Read the current project state and active gate.
2. Resolve only the minimum missing state required for routing.
3. Separate stated facts from model interpretations and unresolved questions.
4. Classify missing information by materiality: blocking, important, or safely deferrable.
5. Ask one decision-sized question at a time and prefer bounded choices when they preserve intent.
6. Reflect the answer back as a change to the intent artifact rather than as chat memory.
7. Request explicit confirmation only after contradictions and hidden assumptions are exposed.
8. Compile a bounded context pack from direct dependencies.
9. Execute the contracted operation without authoring unrelated artifacts.
10. Record decisions, provenance, and audit events.
11. Emit the next eligible skill set and stop condition.

## Verification Questions

- Could two competent teams build materially different products from this intent?
- Is each success measure observable?
- Are constraints distinguished from preferences?
- Has the user confirmed every decision that changes scope, risk, cost, or irreversibility?

## Evidence Packet

Produce or reference all applicable evidence:

- `confirmed-intent artifact`
- `open-question ledger`
- `decision log`

Evidence must identify the current artifact hash, command or method used, result, reviewer identity, timestamp, and limitations.

## Output Contract

Produce:
- `routing-decision`

The primary artifact must include schema version, provenance, consumed artifact IDs, decisions, evidence references, residual risks, validation state, and invalidation targets. Narrative explanation may accompany the artifact but cannot replace it.

## Quality Gate

Reviewer: `independent-reviewer`

- The output directly and completely performs resolving user intent within its declared boundary.
- Could two competent teams build materially different products from this intent?
- Is each success measure observable?
- Are constraints distinguished from preferences?
- Has the user confirmed every decision that changes scope, risk, cost, or irreversibility?
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
- guessing a target user
- treating examples as requirements
- asking a batch of unrelated questions

## Escalation and Invalidation

Stop and request a human decision when scope, risk acceptance, irreversible action, cost ceiling, privacy boundary, or product direction is materially ambiguous. When this artifact changes, invalidate only descendants named by the artifact graph; preserve unaffected verified branches.

## Handoff

- Next transition: the graph router selects a real consumer of `routing-decision`.
- Required evidence: `contract-validation`, `independent-review`, `confirmed-intent artifact`, `open-question ledger`, `decision log`.
- Required envelope fields: `artifactId`, `schemaVersion`, `sha256`, `producingSkill`, `producingAgent`, `consumedArtifacts`, `decisionIds`, `evidenceIds`, `residualRisks`, `validationState`, `invalidationTargets`, `stopCondition`.
- Stop condition: Output contract is satisfied, a blocker is recorded, or a material human decision is required.

## Token and Context Policy

Load at most 8 direct artifacts and reference depth 1. Use stable IDs, hashes, signatures, and deltas instead of repeating full history. Use established domain terminology, state each requirement once, and spend context on decisions, code, tests, or evidence rather than narration.

## Reference Playbook

Load [skills/references/core/kernel.md](../../../references/core/kernel.md) only when this skill needs pack-wide decision tables, evidence patterns, or cross-skill handoff rules.

See `contract.json` for the machine-readable contract.
