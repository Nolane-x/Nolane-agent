# Forge Studio 3.5.0 Adaptive Learning & Trust Fabric Design

## Goal

Reduce the 3.4.0 frontier audit from 70 partial items to 59 by completing eleven local-only requirements: 38.2, 38.6, 38.7, 38.10, 38.12, 38.13, 38.14, 38.18, 47.6, 47.10, and 47.11.

## Scope

The release adds a lazy Adaptive Learning & Trust Fabric. It learns only from verified outcome receipts, evaluates policy candidates on held-out tasks, canaries by deterministic cohort, calibrates confidence and trust by domain/task/tool role, tracks delayed patch survival outcomes, translates a state capsule during a mid-session model or harness switch, and generates teacher challenges that distinguish structural understanding from surface memorization.

It does not change production routing automatically, does not use hidden evaluation tasks for tuning, does not store prompts or chain-of-thought, and does not claim long-term patch survival until a delayed verified receipt exists.

## Architecture

### Task Feature Encoder

`TaskFeatureEncoder` produces a canonical feature vector with task type, language set, repository size, risk, symbol count, context budget, available tool capabilities, locality, and capability matrix revision. The encoder rejects unknown or unbounded raw payloads and signs the normalized vector.

### Held-Out Policy Evaluator

`HeldOutPolicyEvaluator` requires disjoint tuning and held-out task IDs. It compares a baseline and candidate policy using verified outcomes only. Promotion is blocked on leakage, critical regression, insufficient samples, or worse verification-adjusted utility.

### Cohort Canary Governor

`CohortCanaryGovernor` assigns missions to a deterministic named cohort from mission ID and policy hash. It maintains per-cohort baseline/candidate metrics and disables a candidate automatically when pass rate, correction rate, or resource budget regresses beyond configured thresholds. It never promotes production routing.

### Strategy Policy Learner

`StrategyPolicyLearner` records verified outcomes for reasoning effort, tool-call budget, retry budget, and context strategy. It also records delayed patch survival observations between 7 and 30 days, including revert and human rewrite evidence. Unverified or premature survival observations are rejected.

### Domain Trust Ledger

`DomainTrustLedger` maintains independent verified trust buckets for executor, reviewer, and tool identities conditioned on domain and task type. Confidence projections include sample count, posterior success rate, Brier error, and stale evidence count. Reviewer evidence cannot update executor trust and vice versa.

### Model Switch Coordinator

`ModelSwitchCoordinator` saves and reloads an integrity-checked state capsule, applies an explicit harness translation map, validates repository/plan/invariant/git checkpoint continuity, and emits a switch receipt. Unsupported translation, stale capsule state, or missing capability blocks the switch.

### Trajectory Calibration and Teacher Challenges

`AdaptiveLearningControlPlane` composes the existing trajectory confidence calibrator with multi-turn and tool-type stages. `TeacherChallengeLab` generates deterministic structure-vs-surface pairs and challenge variants for mutation, rename, distractor, platform, and prompt-injection resistance. Challenge answers remain separate from executor-visible payloads.

## Integration

The fabric is exposed lazily through `AdaptiveHarnessLab` and `WorldDevelopmentPlane`. Existing fast paths do not instantiate it. Snapshot output contains aggregate metrics and receipts only, never raw prompts, hidden answers, or model outputs.

## Error Handling

All learning writes fail closed unless a 64-character verification receipt is present. Duplicate outcome IDs must be idempotent or rejected on conflict. Held-out leakage, unknown role, stale state capsule, invalid translation, insufficient sample count, early survival observation, and regression canary results return signed blocked receipts or throw typed validation errors.

## Testing

Each component receives direct unit tests with RED→GREEN evidence. Integration tests prove lazy loading and role isolation. Release tests run the measurement twice for identical receipts, verify exactly eleven audit promotions, retain all earlier promotions, keep 63 external gates unchanged, and add the seventy-fourth required release gate.

## Release Target

- Version: 3.5.0
- Verified: 1028
- Partial: 59
- External gate: 63
- Not implemented: 0
- Required release gates: 74
