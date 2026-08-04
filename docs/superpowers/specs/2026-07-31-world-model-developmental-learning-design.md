# Forge Studio 2.29.0 — World Model & Developmental Learning Design

## Goal

Add a bounded, receipt-driven world-model portfolio and developmental self-model that improve action selection without granting autonomous source mutation, memory promotion, policy promotion, or unrestricted goal generation.

## Architecture

### World-Model Portfolio

`WorldModelRegistry` stores domain-scoped models for repository, build, test, runtime, browser, resource, and security. Every model declares version, reliability, cost, failure signatures, supported horizons, and an adapter that returns bounded predictions. `ForesightController` decides whether simulation is worth its cost, selects horizon and rollout count, and falls back to a real probe when reliability is insufficient.

`CounterfactualSimulator` separates `imagine`, `verify`, and `execute`. It may compare no-change, partial-change, and reuse-abstraction candidates, calculate blast radius and rollback feasibility, preserve conflicting rollouts with provenance, cache by state/environment/model digest, and produce decision-relevant deltas. It cannot commit files, write durable memory, run commands, or claim observed truth.

### Self-Model & Developmental Learning

`VerifiedSelfModel` updates domain capability, limits, tool trust, permissions, context/RAM/time ceilings, stale-evidence exposure, responsibility, and residual risk only from verified outcome receipts. Self-declared capability is rejected.

`DevelopmentalGoalEngine` creates sandbox-only learning goals from knowledge gaps, recurring failures, transfer opportunities, and prospective obligations. Goals are scored by learning progress, reuse, mission relevance, compute, and risk. Novelty addiction is blocked when mission completion or critical obligations are delayed.

`DevelopmentalStageController` applies autonomy ceilings and metaplasticity settings per stage. Stage advancement and policy/skill updates require held-out transfer, regression results, future-self simulation, rollback lineage, and a human/policy gate.

### Integration

`WorldDevelopmentPlane` is lazy and is owned by `DecisionPlane`. Existing fast paths remain unchanged. It exposes bounded snapshots and receipts only. No chain-of-thought, raw prompt/output, secret, source content, or hidden benchmark content is stored.

## Failure Handling

- Unknown model domains, stale model digests, non-finite scores, and oversized rollouts fail closed.
- Simulation below reliability threshold returns `real-probe-required`.
- Counterfactual outputs with environment mismatch are invalidated.
- Self-model updates without verified receipts are rejected.
- Autotelic goals outside sandbox, resource, safety, capability, or mission constraints are rejected.
- Stage advancement without held-out transfer and regression evidence is rejected.

## Verification

Two release gates are required:

1. `world-model-portfolio`: model selection, foresight economics, horizon/rollout selection, reliability pruning, counterfactual alternatives, cache invalidation, real-probe fallback, and no-commit boundary.
2. `developmental-agent-learning`: verified self-model updates, tool trust, responsibility, bounded goals, ZPD curriculum, teacher challenges, autonomy stages, metaplasticity, future-self simulation, prospective obligations, goal-conflict protection, novelty guard, and held-out stage gate.

The release must retain explicit non-claims for production policy promotion, autonomous self-modification, open-world long-term learning, and AGI.
