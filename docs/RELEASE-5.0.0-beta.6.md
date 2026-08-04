# Nolane Agent 5.0.0-beta.6 — Release Notes

Beta.6 continues the clean-room conversion of residual NolaneNative behavior into production-wired Nolane-native runtime code. The legacy external runtime and archive remain absent from application, Electron and update packages.

## Native runtime conversion wave 6

This release adds six real runtime components:

- **MCP OAuth Runtime** with PKCE, one-time state, loopback callback validation, credential references, persistence and replay rejection;
- **Browser Supervisor Runtime** with serialized actions, dialog lifecycle, crash state and bounded recovery receipts;
- **Async Delegation Runtime** with persistent worker leases, bounded live logs, stale-worker recovery and independently verified completion;
- **PTY Session Runtime** with backend isolation, bounded replay, input/output budgets and deterministic turn-retry policy;
- **Gateway Recovery Runtime** with heartbeat health, memory-pressure state, drain shutdown and tamper-evident forensics;
- **Local Media Pipeline Runtime** with content-addressed assets, integrity verification, bounded playback queues and voice barge-in.

All six components are connected through `NolaneNativeOrchestrationService`, `RuntimeWave6Fabric` and bounded authenticated HTTP routes.

## Native-core evidence

- **2,110 upstream source/config candidate paths** remain content-addressed in the audit inventory.
- **75 behavioral contracts** are tracked.
- **52 verified contracts** have local implementation, direct and negative tests, production wiring and fresh hashes.
- **23 external contracts** still require provider-real credentials, operating systems, GUI journeys or independent certification.
- **413 verified upstream paths** are mapped to locally verified Nolane-native contracts.

The Master Acceptance Ledger records **1,420 canonical requirements: 1,324 verified and 96 external gates**, with no partial, implemented-not-wired, not-implemented or unmapped rows. The legacy external runtime and archive remain absent. Provider-real and Windows evidence remains external.

`completeParityClaimAllowed=false`

`superiorityClaimAllowed=false`
