---
name: validating-source-credibility
description: "Use when validating source credibility is required during research work, especially when the result must be traceable, independently reviewable, and safe to hand to another agent."
license: MIT
compatibility: "ForgeOS-compatible Agent Skills hosts; no provider-specific model required."
metadata:
  author: forgeos-community
  version: "0.2.0"
  pack: research
  kind: core
  status: stable
---

# Validating Source Credibility

## Overview

This skill owns one bounded responsibility: **validating source credibility**. Its focus is assess authority, recency, directness, methodology, conflicts, corroboration, and claim-specific relevance. It converts declared inputs into typed artifacts and reproducible evidence without silently changing product scope.

## Trigger

Activate only when the project is in one of these stages: `discovery`, `research`, all contract preconditions pass, and the router identifies a missing output this skill can produce. Do not activate merely because the skill name resembles the user request.

## Required Inputs

- `research-evidence`
- `problem-discovery`
- Current gate result, open findings, artifact hashes, and invalidation state
- Required tools: none
- Optional tools: none
- Confirmed human decisions relevant to this scope

## Method-Specific Protocol

1. Decompose each product claim into the evidence it actually requires.
2. Prefer primary and authoritative sources; record when only secondary evidence exists.
3. Check publication date, version, scope, methodology, and incentives.
4. Corroborate load-bearing claims through independent sources where possible.
5. Attach confidence and limitations to each claim, not only to the document.

## Procedure

1. Translate the confirmed brief into answerable research questions.
2. Define source quality and freshness criteria before searching.
3. Decompose each product claim into the evidence it actually requires.
4. Prefer primary and authoritative sources; record when only secondary evidence exists.
5. Check publication date, version, scope, methodology, and incentives.
6. Corroborate load-bearing claims through independent sources where possible.
7. Attach confidence and limitations to each claim, not only to the document.
8. Collect evidence from independent primary or authoritative sources.
9. Separate observations, interpretations, uncertainties, and contradictions.
10. Map findings to product decisions and open questions.
11. Publish a source-linked artifact and research gaps.

## Verification Questions

- Does the source support the exact claim being made?
- Could the fact have changed since publication?
- Are disagreements represented rather than averaged away?
- Is an inference labeled as an inference?

## Evidence Packet

Produce or reference all applicable evidence:

- `source ledger`
- `claim-to-source matrix`
- `freshness record`
- `confidence notes`

Evidence must identify the current artifact hash, command or method used, result, reviewer identity, timestamp, and limitations.

## Output Contract

Produce:
- `research-synthesis`

The primary artifact must include schema version, provenance, consumed artifact IDs, decisions, evidence references, residual risks, validation state, and invalidation targets. Narrative explanation may accompany the artifact but cannot replace it.

## Quality Gate

Reviewer: `independent-reviewer`

- The output directly and completely performs validating source credibility within its declared boundary.
- Does the source support the exact claim being made?
- Could the fact have changed since publication?
- Are disagreements represented rather than averaged away?
- Is an inference labeled as an inference?
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
- citation laundering
- using popularity as authority
- citing a source that only mentions the topic

## Escalation and Invalidation

Stop and request a human decision when scope, risk acceptance, irreversible action, cost ceiling, privacy boundary, or product direction is materially ambiguous. When this artifact changes, invalidate only descendants named by the artifact graph; preserve unaffected verified branches.

## Handoff

- Next transition: the graph router selects a real consumer of `research-synthesis`.
- Required evidence: `contract-validation`, `independent-review`, `source ledger`, `claim-to-source matrix`, `freshness record`, `confidence notes`.
- Required envelope fields: `artifactId`, `schemaVersion`, `sha256`, `producingSkill`, `producingAgent`, `consumedArtifacts`, `decisionIds`, `evidenceIds`, `residualRisks`, `validationState`, `invalidationTargets`, `stopCondition`.
- Stop condition: Output contract is satisfied, a blocker is recorded, or a material human decision is required.

## Token and Context Policy

Load at most 8 direct artifacts and reference depth 1. Use stable IDs, hashes, signatures, and deltas instead of repeating full history. Use established domain terminology, state each requirement once, and spend context on decisions, code, tests, or evidence rather than narration.

## Reference Playbook

Load [skills/references/core/research.md](../../../references/core/research.md) only when this skill needs pack-wide decision tables, evidence patterns, or cross-skill handoff rules.

See `contract.json` for the machine-readable contract.
