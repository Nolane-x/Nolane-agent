# Forge Studio 3.1.0 — Verification Report

## Required evidence

The `intelligence-completion-kernel` release gate verifies:

1. Direct source and `node:test` coverage for all six completion services and lazy fabric integration.
2. A deterministic measurement at `docs/intelligence-completion-measurement-3.1.0.json` with a canonical SHA-256 receipt.
3. Page-local vector reads where `pagesRead = 1` across a three-page fixture and `peakLoadedBytes < totalVectorBytes`.
4. Verified-only context learning and required/unnecessary/inconclusive ablation outcomes under an unchanged verification contract.
5. Cited repository enrichment, bounded CFG/DFG analysis, seven temporal lineage transitions, and isolated patch ablation.
6. An exact audit transition from 3.0.0: only the 13 declared IDs change, all from `not_implemented` to `verified_source_test`.
7. Preservation of 63 external gates and explicit non-claims for autonomous mutation, merge, publish, cloud sandbox, production benchmark, and comparative superiority.

The full release matrix must also pass all inherited architecture, runtime/SDK, ForgeOS audit, and packaging gates on the same commit.
