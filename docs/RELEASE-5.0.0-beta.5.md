# Nolane Agent 5.0.0-beta.5 — Release Notes

Beta.5 continues the clean-room conversion of residual NolaneNative behavior into production-wired Nolane-native runtime code. The legacy external runtime and archive remain absent from application, Electron and update packages.

## Native runtime conversion wave 5

This release adds seven real runtime components:

- **Kanban Runtime** with persistent versioned cards, deterministic transition receipts and optimistic concurrency;
- **Local Observability Runtime** with secret redaction, bounded JSONL segments, backpressure, rotation and cleanup;
- **Skill Bundle Runtime** with safe preprocessing, permission manifests and immutable content hashes;
- **Dashboard Auth Runtime** with password verification, roles, expiring sessions and drain mode;
- **Session Search Runtime** with bounded public indexing, profile filters and hidden-reasoning exclusion;
- **Cron Provider Runtime** with validated intervals, delivery deduplication and stale-lease recovery;
- **JSON Fast Path Runtime** with byte budgets, duplicate-key rejection and safe fallback receipts.

All seven components are connected through `NolaneNativeOrchestrationService` and bounded authenticated HTTP routes.

## Native-core evidence

- **2,110 upstream source/config candidate paths** remain content-addressed in the audit inventory.
- **69 behavioral contracts** are tracked.
- **46 verified contracts** have local implementation, direct and negative tests, production wiring and fresh hashes.
- **23 external contracts** still require provider-real credentials, operating systems, GUI journeys or independent certification.
- **387 verified upstream paths** are mapped to locally verified Nolane-native contracts.

The Master Acceptance Ledger records **1,414 canonical requirements: 1,318 verified and 96 external gates**, with no partial, implemented-not-wired, not-implemented or unmapped rows. The legacy external runtime and archive remain absent. Provider-real and Windows evidence remains external.

`completeParityClaimAllowed=false`

`superiorityClaimAllowed=false`
