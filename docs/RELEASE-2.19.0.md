# Forge Studio 2.19.0 release

## Mission Resource Fabric

This release connects resource governance and coding intelligence at the mission boundary. Forge Studio can now account for provider process trees, keep supported provider sessions warm, collapse duplicate repository changes, stop a regressing harness canary, record browser completion evidence and drive a hosted lifecycle without weakening human control.

### Added

- `MissionProcessLedger` with project/mission/task/provider/session attribution, CPU, RSS, process-count, file-descriptor, peak and exit receipts.
- `ProviderSessionHost` with protocol capability checks, repository/mission affinity, content/harness fingerprints, TTL/max-use invalidation, pressure eviction and honest one-shot fallback.
- Shared `IncrementalIntelligenceJournal` with content-generation coalescing, stale supersession, monotonic consumer cursors and replay after failed consumption.
- `HarnessCanaryController` with deterministic cohort assignment, minimum samples, pass-rate/resource regression cutoffs and operator disable.
- `BrowserJourneyRecorder` for DOM digest, accessibility summary, console/network failures, assertion deltas and project-contained screenshot/video hashes.
- `HostedLifecycleCoordinator` for local verification, branch, pull request, CI, bounded repair and mandatory human merge decision.
- One `MissionResourceFabric` facade wired into provider, repository, browser, runtime status and authenticated read-only HTTP projection.
- Mission / Work / Evidence primary navigation and a bounded resource HUD that reduces effects under pressure.
- Clean-exit Node test subprocesses using Node's test-runner force-exit facility without masking non-zero exit status.
- Required Full Release Matrix gate `mission-resource-fabric` and deterministic synthetic measurement.

### Composition and audit position

`src/app.mjs` remains at 160 static imports and 180 eager constructor expressions. The 790-item audit remains 734 `verified_source_test`, 0 `partial`, 56 `external_gate` and 0 `not_implemented`.

The release does not claim universal OS certification, persistence for one-shot adapters, visual correctness, automatic hosted merge, automatic harness promotion or independent benchmark superiority.
