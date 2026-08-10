---
name: testing-interactive-3d-performance
description: "Use when testing interactive 3d performance is required during interactive-3d product work, especially when the result must be traceable, independently reviewable, and safe to hand to another agent."
license: MIT
compatibility: "ForgeOS-compatible Agent Skills hosts; no provider-specific model required."
metadata:
  author: forgeos-community
  version: "0.2.0"
  pack: domain
  kind: domain
  status: candidate
---

# Testing Interactive 3d Performance

## Overview

This skill owns one bounded responsibility: **testing interactive 3d performance**. Its focus is measure an implemented interactive 3D experience against declared budgets and preserve evidence for failures and fallbacks. It converts declared inputs into typed artifacts and reproducible evidence without silently changing product scope.

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

1. Freeze the build identity, scene, browser or runtime version, device class, test path, and measurement method.
2. Exercise cold start, asset loading, camera movement, interaction bursts, resize, background or foreground recovery, and fallback activation.
3. Record frame-time distribution, startup, memory, errors, asset requests, visual defects, and input failures against explicit budgets.
4. Repeat representative checks across the declared device matrix and classify unsupported environments separately from regressions.
5. Publish raw traces or screenshots where available, summarized results, reproducible steps, limits, and release-blocking findings.

## Procedure

1. Read the confirmed product definition, domain context, assurance profile, and active findings.
2. Identify the domain objects, actors, state transitions, regulations, provider boundaries, and operational constraints owned by this skill.
3. Freeze the build identity, scene, browser or runtime version, device class, test path, and measurement method.
4. Exercise cold start, asset loading, camera movement, interaction bursts, resize, background or foreground recovery, and fallback activation.
5. Record frame-time distribution, startup, memory, errors, asset requests, visual defects, and input failures against explicit budgets.
6. Repeat representative checks across the declared device matrix and classify unsupported environments separately from regressions.
7. Publish raw traces or screenshots where available, summarized results, reproducible steps, limits, and release-blocking findings.
8. Model normal, boundary, failure, recovery, permission, concurrency, migration, and abuse behavior before implementation.
9. Define stable contracts and explicit non-goals; do not leak domain concerns into unrelated modules.
10. Create executable acceptance, negative, resilience, and compatibility checks proportional to risk.
11. Publish the domain artifact, evidence packet, unresolved assumptions, and downstream invalidations.

## Verification Questions

- Can another reviewer identify the exact build, device class, scene, and test path?
- Are p50 and tail latency, memory, startup, and error observations compared with written thresholds?
- Was the fallback deliberately exercised rather than inferred from source code?
- Are unsupported or untested devices reported as such instead of silently passed?

## Evidence Packet

Produce or reference all applicable evidence:

- `runtime test matrix`
- `performance trace summary`
- `fallback exercise record`
- `reproducible defect log`

Evidence must identify the current artifact hash, command or method used, result, reviewer identity, timestamp, and limitations.

## Output Contract

Produce:
- `domain-blueprint`
- `domain-evidence`

The primary artifact must include schema version, provenance, consumed artifact IDs, decisions, evidence references, residual risks, validation state, and invalidation targets. Narrative explanation may accompany the artifact but cannot replace it.

## Quality Gate

Reviewer: `interactive-3d-reviewer`

- The output directly and completely performs testing interactive 3d performance within its declared boundary.
- Can another reviewer identify the exact build, device class, scene, and test path?
- Are p50 and tail latency, memory, startup, and error observations compared with written thresholds?
- Was the fallback deliberately exercised rather than inferred from source code?
- Are unsupported or untested devices reported as such instead of silently passed?
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
- claiming universal frame-rate performance from one machine
- testing only a warm cache
- hiding a fallback failure behind a successful primary path

## Escalation and Invalidation

Stop and request a human decision when scope, risk acceptance, irreversible action, cost ceiling, privacy boundary, or product direction is materially ambiguous. When this artifact changes, invalidate only descendants named by the artifact graph; preserve unaffected verified branches.

## Handoff

- Next transition: the graph router selects a real consumer of `domain-blueprint`, `domain-evidence`.
- Required evidence: `contract-validation`, `independent-review`, `runtime test matrix`, `performance trace summary`, `fallback exercise record`, `reproducible defect log`.
- Required envelope fields: `artifactId`, `schemaVersion`, `sha256`, `producingSkill`, `producingAgent`, `consumedArtifacts`, `decisionIds`, `evidenceIds`, `residualRisks`, `validationState`, `invalidationTargets`, `stopCondition`.
- Stop condition: Output contract is satisfied, a blocker is recorded, or a material human decision is required.

## Token and Context Policy

Load at most 8 direct artifacts and reference depth 1. Use stable IDs, hashes, signatures, and deltas instead of repeating full history. Use established domain terminology, state each requirement once, and spend context on decisions, code, tests, or evidence rather than narration.

## Reference Playbook

Load [skills/references/domains/interactive-3d.md](../../../references/domains/interactive-3d.md) only when this skill needs pack-wide decision tables, evidence patterns, or cross-skill handoff rules.

See `contract.json` for the machine-readable contract.
