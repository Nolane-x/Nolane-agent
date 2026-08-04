# Forge Studio 3.3.0 — Verification Report

## Required Repository Truth Plane evidence

The `repository-truth-plane` release gate verifies:

1. Direct source and `node:test` coverage for the fact ledger, truth-map builder, query planner, paged viewer, Git/worktree adapter, Digital Twin v2, and lazy fabric integration.
2. A deterministic measurement at `docs/repository-truth-plane-measurement-3.3.0.json` with a canonical SHA-256 receipt.
3. A real temporary Git repository with a detected feature branch, worktree, dirty state, and isolated unsaved editor overlay.
4. Cited architecture kinds, symbol relations, runtime relations, cross-branch rejection, and source-hash invalidation.
5. Exact query-stage order, explicit unavailable stages, bounded page loading, and corrupt-cursor rejection.
6. An exact audit transition from 3.2.0: only the declared 11 IDs change from `partial` to `verified_source_test`; all 63 external gates remain unchanged.
7. Explicit non-claims for complete language understanding, uncited runtime causality, comparative superiority, and full-graph page loading.

The full release matrix must pass all 72 required architecture, runtime/SDK, ForgeOS, audit, packaging, fresh-source reconstruction, and archive-integrity gates on the same clean commit.
