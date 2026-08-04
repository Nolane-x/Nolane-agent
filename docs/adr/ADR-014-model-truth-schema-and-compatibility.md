# ADR-014 — Model truth schema and compatibility ownership

**Status:** Accepted for Checkpoint 14 implementation  
**Date:** 2026-08-04

## Context

Nolane already has three model-intelligence layers:

1. `src/model-profiles/*` — advanced exact/family/inferred registry and conservative unknown semantics.
2. `src/providers/model-profile-registry.mjs` — provider-oriented compatibility projection whose public schema is already named `nolane.model-profiles.v2`.
3. `src/model-management/*` — health, policy, recommendation, portfolio and dossier services.

Calling a new canonical schema “model profiles v2” would collide with the existing compatibility API and could create a fourth truth store.

## Decision

- `src/model-profiles/*` remains the canonical profile registry.
- Canonical normalized entities use distinct schema names:
  - `nolane.model-base.v1`
  - `nolane.model-snapshot.v1`
  - `nolane.model-deployment.v1`
  - `nolane.local-model-artifact.v1`
  - `nolane.model-evaluation.v1`
  - `nolane.model-observation.v1`
- The entity bundle is `nolane.model-truth-bundle.v1`.
- `nolane.model-profiles.v2` remains the compatibility export for current provider/runtime/UI consumers.
- Field observations, discovery records, evaluations and runtime observations are durable in `model-intelligence/model-truth-store.json` and never contain credentials.
- The compatibility registry is a projection/adapter. It may append observations to the truth plane but does not become an independent canonical catalog.
- Health and runtime observations have bounded freshness and do not silently overwrite permanent capability truth.
- Legacy normalized profiles are retained inside the migration bundle extension so unknown fields round-trip without becoming `false` or `0`.

## Consequences

- Existing endpoints remain compatible.
- New consumers can request canonical entity bundles and field-level provenance.
- Conflicting strong sources are shown as conflicts and can be used for fail-closed policy decisions.
- Migration can proceed incrementally without a big-bang rewrite of routing or provider adapters.
