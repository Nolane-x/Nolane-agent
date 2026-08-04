# Nolane Agent 5.0.0-beta.4 — Verification Report

## Scope

Beta.4 verifies the fourth native runtime conversion wave through direct tests, negative tests, production wiring, the Master Acceptance Ledger and the full release matrix.

## Runtime-wave evidence

- **Agent Behavior Runtime** removes hidden reasoning from public receipts, bounds one-shot execution and requires independent effect review;
- **Session Lifecycle Runtime** persists checksum-protected metadata, supports branch/rewind/export and recovers after rejected concurrent mutations;
- **Tool Governance Runtime** rejects unsafe URLs and paths, sanitizes schemas and terminal output, and normalizes execution budgets;
- **Profile Configuration Runtime** persists versioned profiles with credential-reference-only storage;
- **OAuth Security Runtime** enforces PKCE, expiring one-time state, redirect validation and revocation receipts.

The catalog has **65 behavioral contracts**, **39 verified contracts**, **26 external contracts**, **2,110 upstream source/config candidate paths**, and **370 verified upstream paths**.

The legacy external runtime and archive remain absent. Provider-real and Windows certification remain explicit external gates.

`completeParityClaimAllowed=false`

`superiorityClaimAllowed=false`
