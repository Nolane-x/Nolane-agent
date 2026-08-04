# Nolane Agent 5.0.0-beta.2 — Verification Report

## Evidence model

- Upstream inventory: 7,617 files and a content-addressed tree receipt.
- Core classification: 5,158 core entries, 2,459 exclusions, zero unmapped paths.
- Candidate coverage: 2,110 upstream source/config candidate paths with individual SHA-256 values.
- Contract catalog: 60 behavioral contracts, 26 verified contracts and 34 external contracts.
- Master Acceptance Ledger: 1,405 canonical requirements, 1,298 verified, 107 external, zero partial/not-implemented/unmapped.
- Full release matrix target: 118 required gates. The final matrix JSON and Markdown are generated only after the committed source tree passes all build, test, clean-room, reconstruction and archive-integrity lanes.

Verified contracts require a production entrypoint, direct test, negative test, production wiring token and fresh evidence hash. External contracts additionally retain an explicit completion condition.

The legacy external runtime and archive remain absent. The historical transformation ledger is retained for provenance and does not execute.

`completeParityClaimAllowed=false`

`superiorityClaimAllowed=false`

Provider-real, Windows, GUI, accessibility and independent benchmark evidence remains external until a replayable receipt exists.
