# Forge Studio 3.2.0 — Verification Report

## Required evidence

The `verified-mission-runtime` release gate verifies:

1. Direct source and `node:test` coverage for the outcome ledger, correctness objective, effect verifier, confidence calibration, decision state machine, semantic progress, resource attribution, disk log, process reaper, runtime composition, and lazy integration.
2. A deterministic measurement at `docs/verified-mission-runtime-measurement-3.2.0.json` with a canonical SHA-256 receipt.
3. Equal verified criterion score at task, milestone, and mission scopes, plus context usefulness derived from passing verification evidence rather than caller totals.
4. Correctness-first ranking, reward-hacking rejection, false-success detection, seven confidence lanes, weakest-link confidence, and evidence-family deduplication.
5. A verifier-bound state sequence that cannot commit before observation, and semantic no-progress detection that treats churn-only diffs as stalled.
6. Measured `rssMbSeconds` attributed to task and mission, disk-backed redacted log restart recovery, and a real Linux child/grandchild cleanup fixture when running on Linux.
7. An exact audit transition from 3.1.0: only the declared 13 IDs change, all from `partial` to `verified_source_test`; 63 external gates remain unchanged.
8. Explicit non-claims for unverified learning value, killing unregistered processes, autonomous merge or publish, independent production benchmarking, and comparative superiority.

The full release matrix must pass all 71 required architecture, runtime/SDK, ForgeOS, audit, packaging, fresh-source reconstruction, and archive-integrity gates on the same clean commit.
