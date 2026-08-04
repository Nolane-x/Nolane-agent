# Nolane Agent 5.0.0-beta.2 — Release Notes

## Native core truth reset

This release replaces the former 14-file retirement proxy with a behavior-level clean-room audit. The legacy external runtime and archive remain absent from Nolane production, source, Electron staging, and update payloads. Historical MIT attribution and the immutable transformation ledger remain evidence only.

The pinned upstream audit covers **7,617 files**, classifies **5,158 core entries**, excludes **2,459 non-core entries with reasons**, and traces **2,110 upstream source/config candidate paths** by SHA-256. These paths are aggregated into **60 behavioral contracts** rather than counted as 2,110 separate product requirements.

## Master Acceptance Ledger

The Master Acceptance Ledger combines the 1,150 legacy requirements, 198 Nolane V5 requirements, and 60 native-core behavioral contracts. Exact semantic aliases are deduplicated without fuzzy merging. The current canonical result is 1,405 requirements: 1,298 verified and 107 external gates, with zero partial, zero not-implemented, and zero unmapped records.

## Native implementations added

- Shared runtime state machine, cancellation tree and immutable receipt chain.
- Tiered prompt/context assembly with cache lineage, secret stripping and hostile-content quarantine.
- Provider fallback, rate-limit rotation, credential references and usage receipts.
- Typed tool/execution backend fabric with timeout, cancellation and cleanup.
- Durable sessions, bounded memory and verified-only skill learning.
- Signed plugin lifecycle, bounded MCP, durable scheduler and worker leases.
- Authorized gateway event ledger and shared API/Electron/TUI projection.
- Operations/security fabric with audit chain, egress policy, backup/restore and provenance checks.
- Native Adapter TCK for provider, platform, memory, media and integration adapters.
- Mixture-of-Agents coordinator with independent proposers, disagreement preservation and verifier-gated synthesis.
- Goal Evidence Contract requiring independently observed effect receipts for completion.

## Claims

`completeParityClaimAllowed=false`

`superiorityClaimAllowed=false`

The release does not claim complete native parity while 34 external contracts require provider-real, platform-real, browser/GUI, Windows, accessibility, installer or independent benchmark receipts.
