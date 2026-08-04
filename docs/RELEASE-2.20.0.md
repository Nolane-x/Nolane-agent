# Forge Studio 2.20.0 release

## Decision Efficiency Loop

This release begins implementation of the 1,150-item Frontier Program. It introduces weighted acceptance criteria, criterion-bound verification, privacy-safe Decision Receipts, verified-value efficiency metrics, Evidence Cards, utility-per-token context selection, counter-evidence reservation, and bounded context escalation.

### Added

- `AcceptanceCriteriaLedger` with immutable criterion IDs, weights, source hashes, and verification receipts.
- Public `forge.decision-receipt.v1` records that exclude hidden reasoning and private provider payloads.
- Token, memory, and edit yield observations based only on verified criteria.
- Evidence Cards with stable provenance and branch/worktree freshness.
- Context Engine V3 utility selection, near-duplicate suppression, counter-evidence budget, and escalation stages.
- One lazy Decision Plane behind Mission Resource Fabric.
- Decision Efficiency projection in the existing Evidence UI.
- Required release gates `decision-efficiency-loop` and `context-engine-v3`.

### Honest audit movement

The feature registry expands from 790 to 1,150 requirements. This release moves only directly evidenced frontier requirements. Partial and not-implemented requirements remain visible rather than being hidden or grouped away.
