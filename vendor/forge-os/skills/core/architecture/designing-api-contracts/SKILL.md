---
name: designing-api-contracts
description: "Use when designing api contracts is required during architecture work, especially when the result must be traceable, independently reviewable, and safe to hand to another agent."
license: MIT
compatibility: "ForgeOS-compatible Agent Skills hosts; no provider-specific model required."
metadata:
  author: forgeos-community
  version: "0.2.0"
  pack: architecture
  kind: core
  status: stable
---

# Designing Api Contracts

## Overview

This skill owns one bounded responsibility: **designing api contracts**. Its focus is define stable request, response, error, idempotency, authorization, pagination, versioning, and observability contracts before implementation. It converts declared inputs into typed artifacts and reproducible evidence without silently changing product scope.

## Trigger

Activate only when the project is in one of these stages: `architecture`, all contract preconditions pass, and the router identifies a missing output this skill can produce. Do not activate merely because the skill name resembles the user request.

## Required Inputs

- `system-boundaries`
- `product-definition`
- Optional: `ux-contract`
- Optional: `domain-blueprint`
- Current gate result, open findings, artifact hashes, and invalidation state
- Required tools: none
- Optional tools: none
- Confirmed human decisions relevant to this scope

## Method-Specific Protocol

1. Map API operations to user and domain capabilities rather than database tables.
2. Define schemas, constraints, examples, errors, side effects, authorization, and idempotency semantics.
3. Specify pagination, filtering, concurrency control, rate limits, retries, and backward compatibility.
4. Generate consumer and provider contract tests from the same specification.
5. Review sensitive fields, tenant boundaries, and logging behavior before implementation.

## Procedure

1. Read product capabilities, quality attributes, and domain constraints.
2. Define boundaries and stable contracts before implementation details.
3. Map API operations to user and domain capabilities rather than database tables.
4. Define schemas, constraints, examples, errors, side effects, authorization, and idempotency semantics.
5. Specify pagination, filtering, concurrency control, rate limits, retries, and backward compatibility.
6. Generate consumer and provider contract tests from the same specification.
7. Review sensitive fields, tenant boundaries, and logging behavior before implementation.
8. Model data, failures, extension points, and operational behavior.
9. Evaluate at least two viable alternatives and trade-offs.
10. Threat-model the selected design and its dependencies.
11. Publish an architecture decision with validation evidence.

## Verification Questions

- Can a client recover from every documented error?
- Are retries safe and duplicate requests defined?
- Does authorization apply to each object and action?
- Can an old client continue after a compatible server change?

## Evidence Packet

Produce or reference all applicable evidence:

- `API specification`
- `contract tests`
- `error catalog`
- `compatibility report`

Evidence must identify the current artifact hash, command or method used, result, reviewer identity, timestamp, and limitations.

## Output Contract

Produce:
- `architecture-decision`

The primary artifact must include schema version, provenance, consumed artifact IDs, decisions, evidence references, residual risks, validation state, and invalidation targets. Narrative explanation may accompany the artifact but cannot replace it.

## Quality Gate

Reviewer: `independent-reviewer`

- The output directly and completely performs designing api contracts within its declared boundary.
- Can a client recover from every documented error?
- Are retries safe and duplicate requests defined?
- Does authorization apply to each object and action?
- Can an old client continue after a compatible server change?
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
- CRUD-shaped APIs
- undocumented 500 responses
- breaking optional fields

## Escalation and Invalidation

Stop and request a human decision when scope, risk acceptance, irreversible action, cost ceiling, privacy boundary, or product direction is materially ambiguous. When this artifact changes, invalidate only descendants named by the artifact graph; preserve unaffected verified branches.

## Handoff

- Next transition: the graph router selects a real consumer of `architecture-decision`.
- Required evidence: `contract-validation`, `independent-review`, `API specification`, `contract tests`, `error catalog`, `compatibility report`.
- Required envelope fields: `artifactId`, `schemaVersion`, `sha256`, `producingSkill`, `producingAgent`, `consumedArtifacts`, `decisionIds`, `evidenceIds`, `residualRisks`, `validationState`, `invalidationTargets`, `stopCondition`.
- Stop condition: Output contract is satisfied, a blocker is recorded, or a material human decision is required.

## Token and Context Policy

Load at most 8 direct artifacts and reference depth 1. Use stable IDs, hashes, signatures, and deltas instead of repeating full history. Use established domain terminology, state each requirement once, and spend context on decisions, code, tests, or evidence rather than narration.

## Reference Playbook

Load [skills/references/core/architecture.md](../../../references/core/architecture.md) only when this skill needs pack-wide decision tables, evidence patterns, or cross-skill handoff rules.

See `contract.json` for the machine-readable contract.
