# Nolane Agent 5.0.0-beta.3 — Verification Report

## Scope

Beta.3 verifies the next clean-room runtime conversion wave through the Master Acceptance Ledger, native-core catalog, direct tests, negative tests, production wiring and the full release matrix.

## Runtime-wave evidence

- ACP JSON-RPC validation, ordering, replay and cancellation;
- provider stream normalization and credential isolation;
- repository search, symbols and content-addressed file-sync plans;
- bounded delegation context;
- approval-gated browser actions and web-search providers;
- gateway adapter lifecycle and exactly-once delivery;
- shared command execution across product surfaces;
- usage pricing, budget and tamper-evident accounting.

The catalog has **61 behavioral contracts**, **34 verified contracts**, **27 external contracts**, **2,110 upstream source/config candidate paths**, and **240 verified upstream paths**. Empty residual external contracts are rejected by test and generator.

The legacy external runtime and archive remain absent. Provider-real and Windows certification remain explicit external gates.

`completeParityClaimAllowed=false`

`superiorityClaimAllowed=false`
