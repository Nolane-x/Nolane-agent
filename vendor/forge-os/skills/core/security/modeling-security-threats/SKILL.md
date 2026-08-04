---
name: modeling-security-threats
description: "Use when modeling security threats is required during security work, especially when the result must be traceable, independently reviewable, and safe to hand to another agent."
license: MIT
compatibility: "ForgeOS-compatible Agent Skills hosts; no provider-specific model required."
metadata:
  author: forgeos-community
  version: "0.2.0"
  pack: security
  kind: core
  status: stable
---

# Modeling Security Threats

## Overview

This skill owns one bounded responsibility: **modeling security threats**. Its focus is model assets, trust boundaries, actors, entry points, abuse cases, controls, and residual risk before implementation. It converts declared inputs into typed artifacts and reproducible evidence without silently changing product scope.

## Trigger

Activate only when the project is in one of these stages: `architecture`, `implementation`, `verification`, `release-readiness`, all contract preconditions pass, and the router identifies a missing output this skill can produce. Do not activate merely because the skill name resembles the user request.

## Required Inputs

- `system-boundaries`
- `product-definition`
- Current gate result, open findings, artifact hashes, and invalidation state
- Required tools: none
- Optional tools: none
- Confirmed human decisions relevant to this scope

## Method-Specific Protocol

1. Draw data and control flows across human, agent, tool, network, storage, and third-party boundaries.
2. Enumerate assets and attacker goals, including cost, privacy, integrity, availability, and model manipulation.
3. Apply threat categories to each boundary and state transition.
4. Map preventive, detective, and recovery controls to concrete tests and owners.
5. Prioritize by plausible impact and exposure; record residual risk and review triggers.

## Procedure

1. Define assets, trust boundaries, actors, and abuse objectives.
2. Map the targeted control or attack surface.
3. Draw data and control flows across human, agent, tool, network, storage, and third-party boundaries.
4. Enumerate assets and attacker goals, including cost, privacy, integrity, availability, and model manipulation.
5. Apply threat categories to each boundary and state transition.
6. Map preventive, detective, and recovery controls to concrete tests and owners.
7. Prioritize by plausible impact and exposure; record residual risk and review triggers.
8. Construct authorized, reproducible adversarial cases.
9. Verify server-side enforcement and least privilege.
10. Record exploitability, impact, remediation, and residual risk.
11. Block release readiness for unresolved critical findings.

## Verification Questions

- Does the model include the AI agent and tool outputs as untrusted?
- Are cross-tenant and confused-deputy paths covered?
- Are cost and supply-chain attacks represented?
- Does every high risk map to a test or accepted residual risk?

## Evidence Packet

Produce or reference all applicable evidence:

- `threat model`
- `abuse-case catalog`
- `control-to-test matrix`
- `residual-risk register`

Evidence must identify the current artifact hash, command or method used, result, reviewer identity, timestamp, and limitations.

## Output Contract

Produce:
- `threat-model`

The primary artifact must include schema version, provenance, consumed artifact IDs, decisions, evidence references, residual risks, validation state, and invalidation targets. Narrative explanation may accompany the artifact but cannot replace it.

## Quality Gate

Reviewer: `security-reviewer`

- The output directly and completely performs modeling security threats within its declared boundary.
- Does the model include the AI agent and tool outputs as untrusted?
- Are cross-tenant and confused-deputy paths covered?
- Are cost and supply-chain attacks represented?
- Does every high risk map to a test or accepted residual risk?
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
- checklist without system flows
- ignoring insiders and automation
- treating the model provider as trusted code

## Escalation and Invalidation

Stop and request a human decision when scope, risk acceptance, irreversible action, cost ceiling, privacy boundary, or product direction is materially ambiguous. When this artifact changes, invalidate only descendants named by the artifact graph; preserve unaffected verified branches.

## Handoff

- Next transition: the graph router selects a real consumer of `threat-model`.
- Required evidence: `contract-validation`, `independent-review`, `threat model`, `abuse-case catalog`, `control-to-test matrix`, `residual-risk register`.
- Required envelope fields: `artifactId`, `schemaVersion`, `sha256`, `producingSkill`, `producingAgent`, `consumedArtifacts`, `decisionIds`, `evidenceIds`, `residualRisks`, `validationState`, `invalidationTargets`, `stopCondition`.
- Stop condition: Output contract is satisfied, a blocker is recorded, or a material human decision is required.

## Token and Context Policy

Load at most 8 direct artifacts and reference depth 1. Use stable IDs, hashes, signatures, and deltas instead of repeating full history. Use established domain terminology, state each requirement once, and spend context on decisions, code, tests, or evidence rather than narration.

## Reference Playbook

Load [skills/references/core/security.md](../../../references/core/security.md) only when this skill needs pack-wide decision tables, evidence patterns, or cross-skill handoff rules.

See `contract.json` for the machine-readable contract.
