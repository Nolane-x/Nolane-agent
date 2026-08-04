# Nolane Agent 5.0.0-beta.4 — Release Notes

Beta.4 continues the clean-room conversion of residual NolaneNative behavior into production-wired Nolane-native runtime code. The legacy external runtime and archive remain absent from application, Electron and update packages.

## Native runtime conversion wave 4

This release adds five real runtime components:

- **Agent Behavior Runtime** for public-message normalization, deterministic titles, bounded one-shot execution, error classification, independent effect review and replay cleanup without hidden reasoning;
- **Session Lifecycle Runtime** for profile-scoped search, pin/status metadata, branching, rewind, bounded input history, prompt queues and safe JSON/Markdown/HTML export;
- **Tool Governance Runtime** for schema sanitation, HTTPS/private-network policy, ANSI-safe output, bounded diff/checkpoint handling and normalized tool budgets;
- **Profile Configuration Runtime** for persistent versioned profiles, validated settings, credential references and conflict-safe updates;
- **OAuth Security Runtime** for PKCE, one-time state, validated redirects, expiry, credential references and revocation receipts.

All five components are connected through `NolaneNativeOrchestrationService` and authenticated bounded HTTP routes. Optimistic-version conflicts no longer poison later writes.

## Native-core evidence

- **2,110 upstream source/config candidate paths** remain content-addressed in the audit inventory.
- **65 behavioral contracts** are tracked.
- **39 verified contracts** have local implementation, direct and negative tests, production wiring and fresh hashes.
- **26 external contracts** still require provider-real credentials, operating systems, GUI journeys or independent certification.
- **370 verified upstream paths** are mapped to locally verified Nolane-native contracts.

The Master Acceptance Ledger records **1,410 canonical requirements: 1,311 verified and 99 external gates**, with no partial, implemented-not-wired, not-implemented or unmapped rows.

The legacy external runtime and archive remain absent. Provider-real and Windows evidence remains external.

`completeParityClaimAllowed=false`

`superiorityClaimAllowed=false`
