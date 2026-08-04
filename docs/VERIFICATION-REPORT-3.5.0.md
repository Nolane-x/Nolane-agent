# Forge Studio 3.5.0 — Verification Report

The `adaptive-learning-trust-fabric` release gate verifies:

1. Direct source and `node:test` coverage for the feature encoder, held-out evaluator, cohort governor, strategy learner, trust ledger, model switch coordinator, adaptive control plane and teacher challenge lab.
2. A deterministic measurement at `docs/adaptive-learning-trust-fabric-measurement-3.5.0.json` with a canonical SHA-256 receipt.
3. Routing conditioned on task type, language, repository size, risk, symbol/context signals, tools and capability-matrix revision.
4. Strictly disjoint tuning and held-out sets; critical regressions block candidate promotion even when aggregate utility rises.
5. Cohort-isolated canary metrics and automatic candidate disable on pass-rate, correction or resource regressions, without automatic production promotion.
6. Verified-only learning of reasoning effort, tool budget, retry budget and context strategy, plus delayed 7–30 day patch-survival observations.
7. Domain/task/role-isolated executor, reviewer and tool trust with posterior success, Brier score and stale-evidence handling.
8. Mid-session model switching only through a valid state capsule, capability check and harness-translation receipt.
9. Multi-turn and tool-type trajectory calibration, structure-versus-surface paired tasks, deterministic challenge mutations and oracle separation.
10. An exact audit transition from 3.4.0: only the declared 11 IDs move from `partial` to `verified_source_test`; all 63 external gates remain unchanged.
11. Explicit non-claims for automatic production routing, held-out tuning, unobserved long-term survival, oracle exposure and benchmark superiority.

The full release matrix must pass all 74 required gates on the same clean commit.
