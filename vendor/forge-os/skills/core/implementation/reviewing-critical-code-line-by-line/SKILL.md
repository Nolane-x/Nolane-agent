---
name: reviewing-critical-code-line-by-line
description: "Use when reviewing critical code line by line is required during implementation work, especially when the result must be traceable, independently reviewable, and safe to hand to another agent."
license: MIT
compatibility: "ForgeOS-compatible Agent Skills hosts; no provider-specific model required."
metadata:
  author: forgeos-community
  version: "0.2.0"
  pack: implementation
  kind: core
  status: stable
---

# Reviewing Critical Code Line By Line

## Overview

This skill owns one bounded responsibility: **reviewing critical code line by line**. Its focus is review high-impact code with complete data-flow, control-flow, failure, concurrency, and trust-boundary coverage. It converts declared inputs into typed artifacts and reproducible evidence without silently changing product scope.

## Trigger

Activate only when the project is in one of these stages: `implementation`, all contract preconditions pass, and the router identifies a missing output this skill can produce. Do not activate merely because the skill name resembles the user request.

## Required Inputs

- `implemented-increment`
- Optional: `acceptance-contracts`
- Current gate result, open findings, artifact hashes, and invalidation state
- Required tools: `filesystem`, `shell`
- Optional tools: none
- Confirmed human decisions relevant to this scope

## Method-Specific Protocol

1. Define why the module is critical and identify assets, callers, side effects, invariants, and failure consequences.
2. Trace every input from origin through validation, transformation, authorization, persistence, and output.
3. Review each branch, error path, cleanup path, retry, timeout, and concurrent interleaving.
4. Cross-check code against requirements, tests, dependency behavior, and operational telemetry.
5. Record findings with exact lines, exploit or failure scenario, severity, and required evidence for closure.

## Procedure

1. Load one task, its direct contracts, and its failing test.
2. Verify the test fails for the intended missing behavior.
3. Define why the module is critical and identify assets, callers, side effects, invariants, and failure consequences.
4. Trace every input from origin through validation, transformation, authorization, persistence, and output.
5. Review each branch, error path, cleanup path, retry, timeout, and concurrent interleaving.
6. Cross-check code against requirements, tests, dependency behavior, and operational telemetry.
7. Record findings with exact lines, exploit or failure scenario, severity, and required evidence for closure.
8. Implement the minimum sufficient change.
9. Run focused tests, then relevant regression tests.
10. Review the diff for complexity, security, and contract drift.
11. Commit evidence and hand off to independent review.

## Verification Questions

- Can malformed, stale, duplicated, reordered, or unauthorized input reach a side effect?
- Can partial failure leave durable corruption or cost?
- Do tests kill plausible mutations in critical branches?
- Can logs or errors disclose secrets?

## Evidence Packet

Produce or reference all applicable evidence:

- `annotated diff`
- `data-flow map`
- `finding ledger`
- `closure evidence`

Evidence must identify the current artifact hash, command or method used, result, reviewer identity, timestamp, and limitations.

## Output Contract

Produce:
- `verified-build`

The primary artifact must include schema version, provenance, consumed artifact IDs, decisions, evidence references, residual risks, validation state, and invalidation targets. Narrative explanation may accompany the artifact but cannot replace it.

## Quality Gate

Reviewer: `independent-reviewer`

- The output directly and completely performs reviewing critical code line by line within its declared boundary.
- Can malformed, stale, duplicated, reordered, or unauthorized input reach a side effect?
- Can partial failure leave durable corruption or cost?
- Do tests kill plausible mutations in critical branches?
- Can logs or errors disclose secrets?
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
- style-only review
- trusting test coverage percentage
- reviewer silently fixing findings

## Escalation and Invalidation

Stop and request a human decision when scope, risk acceptance, irreversible action, cost ceiling, privacy boundary, or product direction is materially ambiguous. When this artifact changes, invalidate only descendants named by the artifact graph; preserve unaffected verified branches.

## Handoff

- Next transition: the graph router selects a real consumer of `verified-build`.
- Required evidence: `contract-validation`, `independent-review`, `annotated diff`, `data-flow map`, `finding ledger`, `closure evidence`.
- Required envelope fields: `artifactId`, `schemaVersion`, `sha256`, `producingSkill`, `producingAgent`, `consumedArtifacts`, `decisionIds`, `evidenceIds`, `residualRisks`, `validationState`, `invalidationTargets`, `stopCondition`.
- Stop condition: Output contract is satisfied, a blocker is recorded, or a material human decision is required.

## Token and Context Policy

Load at most 8 direct artifacts and reference depth 1. Use stable IDs, hashes, signatures, and deltas instead of repeating full history. Use established domain terminology, state each requirement once, and spend context on decisions, code, tests, or evidence rather than narration.

## Reference Playbook

Load [skills/references/core/implementation.md](../../../references/core/implementation.md) only when this skill needs pack-wide decision tables, evidence patterns, or cross-skill handoff rules.

See `contract.json` for the machine-readable contract.
