# Master Acceptance Ledger

Product version: **5.0.0-beta.6**

## Canonical scope

- Legacy requirements: **1,150**
- Nolane V5 requirements: **198**
- NolaneNative core contract candidates: **115**
- Input rows: **1,463**
- Canonical rows after exact semantic deduplication: **1,460**
- Duplicate aliases removed from totals: **3**

## Status

- Verified: **1372**
- External gate: **88**
- Implemented but not wired: **0**
- Not implemented: **0**
- Unmapped: **0**

## Interpretation

The NolaneNative rows are inventory-derived behavior candidates. Their status is upgraded only by the Nolane Native Core Contract Catalog when production entrypoints, direct conformance tests, negative tests, and fresh evidence hashes are present. External and open behavior remains visible; the ledger never infers parity from file existence.

Exact-title duplicates are represented as aliases under one canonical requirement. Similar but non-identical requirements remain separate to avoid hiding work through fuzzy matching.

Ledger receipt SHA-256: `03c2b351458e915aa11b8985578494c779deae5fc9d23954c8ec4040c083780d`

