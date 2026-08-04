# Nolane Native Core Parity — 5.0.0-beta.2

## Scope

The audit reads a pinned upstream source snapshot and classifies every path. It does not copy upstream implementation into Nolane. **2,110 upstream source/config candidate paths** are mapped to **60 behavioral contracts**, preserving every path and SHA-256 in the conformance receipt.

## Current conformance

- **26 verified contracts** have Nolane-owned implementation, direct and negative tests, production wiring and fresh hashes.
- **34 external contracts** have typed Nolane boundaries and explicit completion conditions but still require provider-real, platform-real, browser/GUI, Windows, accessibility, installer or independent benchmark receipts.
- Zero candidate paths are unmapped.
- Zero contracts are marked partial or not implemented.

A behavior can remain external even when its generic adapter contract exists. For example, the Native Adapter TCK proves lifecycle, permissions, cancellation, cleanup, receipt chaining and secret isolation; it does not prove Discord, Slack, WhatsApp, every model provider or every media service without real credentials and service receipts.

The legacy external runtime and archive remain absent. Historical MIT attribution and the transformation ledger remain provenance evidence only.

`completeParityClaimAllowed=false`

`superiorityClaimAllowed=false`
