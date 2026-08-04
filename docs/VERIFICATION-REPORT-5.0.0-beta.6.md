# Nolane Agent 5.0.0-beta.6 — Verification Report

## Scope

Beta.6 verifies the sixth native runtime conversion wave through direct tests, negative tests, production wiring, the Master Acceptance Ledger and the full release matrix.

## Runtime-wave evidence

- MCP OAuth uses one-time PKCE state, loopback callbacks, credential references and restart persistence;
- browser supervision serializes actions, handles dialogs and records crash/recovery state;
- async delegation persists bounded logs, rejects stale workers and requires independent verification before completion;
- PTY sessions bound input/output and replay while applying deterministic retry policy;
- gateway recovery tracks heartbeat and memory pressure, drains safely and preserves forensic receipts;
- local media assets are content-addressed, integrity-checked and used by a bounded playback/barge-in state machine.

The catalog has **75 behavioral contracts**, **52 verified contracts**, **23 external contracts**, **2,110 upstream source/config candidate paths**, and **413 verified upstream paths**. The Master Acceptance Ledger records **1,420 canonical requirements: 1,324 verified and 96 external gates**.

The legacy external runtime and archive remain absent. Provider-real and Windows certification remain explicit external gates.

`completeParityClaimAllowed=false`

`superiorityClaimAllowed=false`
