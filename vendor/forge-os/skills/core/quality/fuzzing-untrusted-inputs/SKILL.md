---
name: fuzzing-untrusted-inputs
description: "Use when fuzzing untrusted inputs is required during quality work, especially when the result must be traceable, independently reviewable, and safe to hand to another agent."
license: MIT
compatibility: "ForgeOS-compatible Agent Skills hosts; no provider-specific model required."
metadata:
  author: forgeos-community
  version: "0.2.0"
  pack: quality
  kind: core
  status: stable
---

# Fuzzing Untrusted Inputs

## Overview

This skill owns one bounded responsibility: **fuzzing untrusted inputs**. Its focus is exercise parsers, protocol boundaries, file formats, and user-controlled fields with structured malformed input. It converts declared inputs into typed artifacts and reproducible evidence without silently changing product scope.

## Trigger

Activate only when the project is in one of these stages: `verification`, all contract preconditions pass, and the router identifies a missing output this skill can produce. Do not activate merely because the skill name resembles the user request.

## Required Inputs

- `test-plan`
- `verified-build`
- Optional: `domain-evidence`
- Current gate result, open findings, artifact hashes, and invalidation state
- Required tools: `test-runner`
- Optional tools: none
- Confirmed human decisions relevant to this scope

## Method-Specific Protocol

1. Inventory every decoder and externally controlled byte or value boundary.
2. Build seed corpora from valid examples, historical failures, boundary values, and protocol dictionaries.
3. Define crash, timeout, memory, invariant, authorization, and differential oracles.
4. Run mutation or grammar-based fuzzing under bounded resources and capture exact seeds.
5. Minimize failures, classify reachability and impact, then promote them to regression fixtures.

## Procedure

1. Derive checks from requirements, contracts, invariants, and observed risks.
2. Create a test that can fail for the intended defect class.
3. Inventory every decoder and externally controlled byte or value boundary.
4. Build seed corpora from valid examples, historical failures, boundary values, and protocol dictionaries.
5. Define crash, timeout, memory, invariant, authorization, and differential oracles.
6. Run mutation or grammar-based fuzzing under bounded resources and capture exact seeds.
7. Minimize failures, classify reachability and impact, then promote them to regression fixtures.
8. Run the test against the current system and record the baseline.
9. Exercise positive, negative, boundary, and recovery behavior.
10. Classify findings by impact, reproducibility, and affected scope.
11. Publish evidence without masking critical failures behind aggregate scores.

## Verification Questions

- Does the fuzzer reach deep parser states?
- Are hangs and resource exhaustion treated as failures?
- Can the same seed reproduce the issue?
- Are sensitive production systems excluded from unsafe fuzzing?

## Evidence Packet

Produce or reference all applicable evidence:

- `seed corpus`
- `fuzz configuration`
- `crash or hang artifacts`
- `minimized regression cases`

Evidence must identify the current artifact hash, command or method used, result, reviewer identity, timestamp, and limitations.

## Output Contract

Produce:
- `verification-report`
- `ux-evidence`

The primary artifact must include schema version, provenance, consumed artifact IDs, decisions, evidence references, residual risks, validation state, and invalidation targets. Narrative explanation may accompany the artifact but cannot replace it.

## Quality Gate

Reviewer: `quality-reviewer`

- The output directly and completely performs fuzzing untrusted inputs within its declared boundary.
- Does the fuzzer reach deep parser states?
- Are hangs and resource exhaustion treated as failures?
- Can the same seed reproduce the issue?
- Are sensitive production systems excluded from unsafe fuzzing?
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
- random strings only
- unbounded fuzz execution
- closing crashes without regression tests

## Escalation and Invalidation

Stop and request a human decision when scope, risk acceptance, irreversible action, cost ceiling, privacy boundary, or product direction is materially ambiguous. When this artifact changes, invalidate only descendants named by the artifact graph; preserve unaffected verified branches.

## Handoff

- Next transition: the graph router selects a real consumer of `verification-report`, `ux-evidence`.
- Required evidence: `contract-validation`, `independent-review`, `seed corpus`, `fuzz configuration`, `crash or hang artifacts`, `minimized regression cases`.
- Required envelope fields: `artifactId`, `schemaVersion`, `sha256`, `producingSkill`, `producingAgent`, `consumedArtifacts`, `decisionIds`, `evidenceIds`, `residualRisks`, `validationState`, `invalidationTargets`, `stopCondition`.
- Stop condition: Output contract is satisfied, a blocker is recorded, or a material human decision is required.

## Token and Context Policy

Load at most 8 direct artifacts and reference depth 1. Use stable IDs, hashes, signatures, and deltas instead of repeating full history. Use established domain terminology, state each requirement once, and spend context on decisions, code, tests, or evidence rather than narration.

## Reference Playbook

Load [skills/references/core/quality.md](../../../references/core/quality.md) only when this skill needs pack-wide decision tables, evidence patterns, or cross-skill handoff rules.

See `contract.json` for the machine-readable contract.
