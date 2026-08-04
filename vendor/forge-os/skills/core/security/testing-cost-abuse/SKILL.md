---
name: testing-cost-abuse
description: "Use when testing cost abuse is required during security work, especially when the result must be traceable, independently reviewable, and safe to hand to another agent."
license: MIT
compatibility: "ForgeOS-compatible Agent Skills hosts; no provider-specific model required."
metadata:
  author: forgeos-community
  version: "0.2.0"
  pack: security
  kind: core
  status: stable
---

# Testing Cost Abuse

## Overview

This skill owns one bounded responsibility: **testing cost abuse**. Its focus is find attacker-controlled paths that amplify metered compute, model, storage, notification, or third-party spend. It converts declared inputs into typed artifacts and reproducible evidence without silently changing product scope.

## Trigger

Activate only when the project is in one of these stages: `architecture`, `implementation`, `verification`, `release-readiness`, all contract preconditions pass, and the router identifies a missing output this skill can produce. Do not activate merely because the skill name resembles the user request.

## Required Inputs

- `threat-model`
- `verified-build`
- Current gate result, open findings, artifact hashes, and invalidation state
- Required tools: none
- Optional tools: none
- Confirmed human decisions relevant to this scope

## Method-Specific Protocol

1. Inventory every metered operation and calculate cost per request, retry, fan-out, and retained artifact.
2. Model attacker budget versus defender cost amplification.
3. Exercise burst, replay, concurrency, recursive workflows, oversized context, cache busting, and failed-payment paths.
4. Verify quotas, idempotency, backpressure, cancellation, spending caps, and anomaly alerts server-side.
5. Calculate worst-case daily exposure and require explicit acceptance when it exceeds the product risk budget.

## Procedure

1. Define assets, trust boundaries, actors, and abuse objectives.
2. Map the targeted control or attack surface.
3. Inventory every metered operation and calculate cost per request, retry, fan-out, and retained artifact.
4. Model attacker budget versus defender cost amplification.
5. Exercise burst, replay, concurrency, recursive workflows, oversized context, cache busting, and failed-payment paths.
6. Verify quotas, idempotency, backpressure, cancellation, spending caps, and anomaly alerts server-side.
7. Calculate worst-case daily exposure and require explicit acceptance when it exceeds the product risk budget.
8. Construct authorized, reproducible adversarial cases.
9. Verify server-side enforcement and least privilege.
10. Record exploitability, impact, remediation, and residual risk.
11. Block release readiness for unresolved critical findings.

## Verification Questions

- Can one cheap request trigger many expensive downstream calls?
- Can retries or partial failures double-charge?
- Are per-user, per-tenant, and global caps independent?
- Does cancellation stop already queued cost?

## Evidence Packet

Produce or reference all applicable evidence:

- `cost surface map`
- `amplification calculations`
- `abuse test logs`
- `cap and alert evidence`

Evidence must identify the current artifact hash, command or method used, result, reviewer identity, timestamp, and limitations.

## Output Contract

Produce:
- `security-review`

The primary artifact must include schema version, provenance, consumed artifact IDs, decisions, evidence references, residual risks, validation state, and invalidation targets. Narrative explanation may accompany the artifact but cannot replace it.

## Quality Gate

Reviewer: `security-reviewer`

- The output directly and completely performs testing cost abuse within its declared boundary.
- Can one cheap request trigger many expensive downstream calls?
- Can retries or partial failures double-charge?
- Are per-user, per-tenant, and global caps independent?
- Does cancellation stop already queued cost?
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
- rate limits without cost modeling
- average-case unit economics
- alerts without hard caps

## Escalation and Invalidation

Stop and request a human decision when scope, risk acceptance, irreversible action, cost ceiling, privacy boundary, or product direction is materially ambiguous. When this artifact changes, invalidate only descendants named by the artifact graph; preserve unaffected verified branches.

## Handoff

- Next transition: the graph router selects a real consumer of `security-review`.
- Required evidence: `contract-validation`, `independent-review`, `cost surface map`, `amplification calculations`, `abuse test logs`, `cap and alert evidence`.
- Required envelope fields: `artifactId`, `schemaVersion`, `sha256`, `producingSkill`, `producingAgent`, `consumedArtifacts`, `decisionIds`, `evidenceIds`, `residualRisks`, `validationState`, `invalidationTargets`, `stopCondition`.
- Stop condition: Output contract is satisfied, a blocker is recorded, or a material human decision is required.

## Token and Context Policy

Load at most 8 direct artifacts and reference depth 1. Use stable IDs, hashes, signatures, and deltas instead of repeating full history. Use established domain terminology, state each requirement once, and spend context on decisions, code, tests, or evidence rather than narration.

## Reference Playbook

Load [skills/references/core/security.md](../../../references/core/security.md) only when this skill needs pack-wide decision tables, evidence patterns, or cross-skill handoff rules.

See `contract.json` for the machine-readable contract.
