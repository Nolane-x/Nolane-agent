---
name: designing-saas-tenancy
description: "Use when designing saas tenancy is required during saas product work, especially when the result must be traceable, independently reviewable, and safe to hand to another agent."
license: MIT
compatibility: "ForgeOS-compatible Agent Skills hosts; no provider-specific model required."
metadata:
  author: forgeos-community
  version: "0.2.0"
  pack: domain
  kind: domain
  status: stable
---

# Designing Saas Tenancy

## Overview

This skill owns one bounded responsibility: **designing saas tenancy**. Its focus is define tenant identity, data ownership, isolation, provisioning, lifecycle, and operational boundaries. It converts declared inputs into typed artifacts and reproducible evidence without silently changing product scope.

## Trigger

Activate only when the project is in one of these stages: `product-definition`, `ux-design`, `architecture`, `planning`, `implementation`, `verification`, `release-readiness`, all contract preconditions pass, and the router identifies a missing output this skill can produce. Do not activate merely because the skill name resembles the user request.

## Required Inputs

- `product-definition`
- Optional: `architecture-decision`
- Optional: `verified-build`
- Current gate result, open findings, artifact hashes, and invalidation state
- Required tools: none
- Optional tools: none
- Confirmed human decisions relevant to this scope

## Method-Specific Protocol

1. Choose tenancy model from isolation, cost, scale, compliance, and migration requirements.
2. Define tenant context propagation through authentication, authorization, storage, queues, caches, logs, and background jobs.
3. Make every tenant-scoped query and side effect structurally require tenant identity.
4. Plan provisioning, suspension, deletion, export, backup, restore, and tenant migration.
5. Create cross-tenant negative tests and operational detection signals.

## Procedure

1. Read the confirmed product definition, domain context, assurance profile, and active findings.
2. Identify the domain objects, actors, state transitions, regulations, provider boundaries, and operational constraints owned by this skill.
3. Choose tenancy model from isolation, cost, scale, compliance, and migration requirements.
4. Define tenant context propagation through authentication, authorization, storage, queues, caches, logs, and background jobs.
5. Make every tenant-scoped query and side effect structurally require tenant identity.
6. Plan provisioning, suspension, deletion, export, backup, restore, and tenant migration.
7. Create cross-tenant negative tests and operational detection signals.
8. Model normal, boundary, failure, recovery, permission, concurrency, migration, and abuse behavior before implementation.
9. Define stable contracts and explicit non-goals; do not leak domain concerns into unrelated modules.
10. Create executable acceptance, negative, resilience, and compatibility checks proportional to risk.
11. Publish the domain artifact, evidence packet, unresolved assumptions, and downstream invalidations.

## Verification Questions

- Can any identifier be used without tenant context?
- Are caches and async jobs tenant-safe?
- Can administrators cross boundaries only through audited authority?
- Can one tenant be restored or deleted without affecting others?

## Evidence Packet

Produce or reference all applicable evidence:

- `tenancy decision`
- `tenant data map`
- `isolation test suite`
- `lifecycle runbook`

Evidence must identify the current artifact hash, command or method used, result, reviewer identity, timestamp, and limitations.

## Output Contract

Produce:
- `domain-blueprint`
- `domain-evidence`

The primary artifact must include schema version, provenance, consumed artifact IDs, decisions, evidence references, residual risks, validation state, and invalidation targets. Narrative explanation may accompany the artifact but cannot replace it.

## Quality Gate

Reviewer: `saas-reviewer`

- The output directly and completely performs designing saas tenancy within its declared boundary.
- Can any identifier be used without tenant context?
- Are caches and async jobs tenant-safe?
- Can administrators cross boundaries only through audited authority?
- Can one tenant be restored or deleted without affecting others?
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
- tenant ID filtering by convention
- shared cache keys
- support impersonation without audit

## Escalation and Invalidation

Stop and request a human decision when scope, risk acceptance, irreversible action, cost ceiling, privacy boundary, or product direction is materially ambiguous. When this artifact changes, invalidate only descendants named by the artifact graph; preserve unaffected verified branches.

## Handoff

- Next transition: the graph router selects a real consumer of `domain-blueprint`, `domain-evidence`.
- Required evidence: `contract-validation`, `independent-review`, `tenancy decision`, `tenant data map`, `isolation test suite`, `lifecycle runbook`.
- Required envelope fields: `artifactId`, `schemaVersion`, `sha256`, `producingSkill`, `producingAgent`, `consumedArtifacts`, `decisionIds`, `evidenceIds`, `residualRisks`, `validationState`, `invalidationTargets`, `stopCondition`.
- Stop condition: Output contract is satisfied, a blocker is recorded, or a material human decision is required.

## Token and Context Policy

Load at most 8 direct artifacts and reference depth 1. Use stable IDs, hashes, signatures, and deltas instead of repeating full history. Use established domain terminology, state each requirement once, and spend context on decisions, code, tests, or evidence rather than narration.

## Reference Playbook

Load [skills/references/domains/saas.md](../../../references/domains/saas.md) only when this skill needs pack-wide decision tables, evidence patterns, or cross-skill handoff rules.

See `contract.json` for the machine-readable contract.
