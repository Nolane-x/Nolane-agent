# Nolane Agent 5.0.0-beta.3 — Release Notes

Beta.3 continues the clean-room conversion of previously external NolaneNative runtime behavior into production-wired Nolane-native code. The legacy external runtime and archive remain absent from application, Electron and update packages.

## Native runtime conversion wave

This release adds eight real runtime components rather than file-existence placeholders:

- ordered and cancellable ACP JSON-RPC streaming;
- provider protocol normalization and streamed tool-call assembly;
- bounded repository search, symbol lookup and safe file-sync planning;
- bounded delegation context with omission receipts;
- approved browser actions and a credential-isolated search-provider registry;
- gateway adapter lifecycle and exactly-once delivery;
- one shared command surface for CLI, TUI, web and Electron;
- tamper-evident usage, pricing, latency and budget accounting.

Every component is connected through `NolaneNativeOrchestrationService`, authenticated HTTP routes and the application bootstrap. Negative tests cover cancellation, duplicate requests, unsafe paths, missing approvals, secret exposure, output limits and duplicate delivery.

## Native-core evidence

- **2,110 upstream source/config candidate paths** remain content-addressed in the audit inventory.
- **61 behavioral contracts** remain after empty residual contracts are pruned.
- **34 verified contracts** have local implementation, direct and negative tests, production wiring and fresh hashes.
- **27 external contracts** still require real providers, credentials, operating systems, GUI journeys or independent certification.
- **240 verified upstream paths** are now mapped to locally verified Nolane-native contracts.
- 1,870 upstream paths remain mapped to external certification contracts.

The Master Acceptance Ledger records 1,406 canonical requirements: 1,306 verified and 100 external gates, with no partial, implemented-not-wired, not-implemented or unmapped rows.

`completeParityClaimAllowed=false`

`superiorityClaimAllowed=false`
