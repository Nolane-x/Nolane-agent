# Mission Resource Fabric Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Forge Studio 2.19.0 with per-mission process accounting, safe provider-session reuse, shared incremental intelligence, harness canaries, browser journey receipts, honest hosted lifecycle orchestration, a simplified Mission/Work/Evidence UI shell, and clean release-runner termination.

**Architecture:** New capabilities live behind one lazy `MissionResourceFabric` facade so `src/app.mjs` gains only one import and one constructor. Each subsystem is independently testable and exposes immutable receipt-bearing snapshots. Existing provider, repository, browser and runtime paths adopt the facade through narrow optional hooks.

**Tech Stack:** Node.js 22 ESM, built-in `node:test`, SQLite-backed existing stores where persistence is required, Playwright CLI adapter, plain browser JavaScript/CSS, existing release verifier/matrix framework.

## Global Constraints

- Do not add a mandatory external runtime or npm dependency.
- Do not persist raw prompts, model outputs, secrets, authorization headers, or unrestricted command lines.
- Do not claim process persistence for one-shot CLI providers.
- Keep `src/app.mjs` at or below 161 static imports and 181 constructor expressions.
- Preserve audit counts: 734 source+test, 0 partial, 56 external gate, 0 not implemented.
- All new public snapshots and receipts are immutable and include a SHA-256 receipt.
- UI animations obey the existing reduced-effects and pressure policies.

---

### Task 1: Mission Process Ledger

**Files:**
- Create: `src/runtime/mission-process-ledger.mjs`
- Modify: `src/sandbox/linux-proc-resource-driver.mjs`
- Modify: `src/sandbox/platform-resource-driver.mjs`
- Test: `tests/mission-process-ledger.test.mjs`
- Test: `tests/platform-resource-driver.test.mjs`

**Interfaces:**
- Consumes: `driver.sampleTree(pid)` and optional `driver.sampleFileDescriptors(pid)`.
- Produces: `register(input)`, `sample(id)`, `finalize(id, reason)`, `snapshot(filter)`, `close()`.

- [ ] Write failing tests for mission attribution, peak RSS, CPU deltas, unavailable FD reporting, process disappearance and redaction.
- [ ] Run `node --test tests/mission-process-ledger.test.mjs tests/platform-resource-driver.test.mjs` and confirm failure.
- [ ] Implement bounded immutable ledger receipts and platform FD sampling where supported.
- [ ] Re-run focused tests and confirm pass.
- [ ] Commit `feat: add mission process resource ledger`.

### Task 2: Protocol-aware Provider Session Host

**Files:**
- Create: `src/providers/provider-session-host.mjs`
- Modify: `src/providers/codex-app-server.mjs`
- Modify: `src/providers/provider-registry.mjs`
- Test: `tests/provider-session-host.test.mjs`
- Test: `tests/codex-session-reuse.test.mjs`

**Interfaces:**
- Consumes: provider adapters with optional `sessionCapabilities()`, `openSession()`, `completeInSession()`, `closeSession()`.
- Produces: `complete({ provider, request, scope, fingerprint, signal })`, `evict(input)`, `snapshot()`, `close()`.

- [ ] Write failing tests proving Codex thread reuse, one-shot fallback, stale fingerprint invalidation, max-use eviction and pressure eviction.
- [ ] Run focused tests and confirm failure.
- [ ] Add reusable Codex thread methods without changing one-shot compatibility.
- [ ] Implement host admission, session fingerprinting, TTL and receipt journal.
- [ ] Re-run focused tests and confirm pass.
- [ ] Commit `feat: add provider session host`.

### Task 3: Shared Incremental Intelligence Journal

**Files:**
- Create: `src/repository/incremental-intelligence-journal.mjs`
- Modify: `src/repository/repository-intelligence-scheduler.mjs`
- Modify: `src/repository/adaptive-repository-intelligence.mjs`
- Test: `tests/incremental-intelligence-journal.test.mjs`
- Test: `tests/repository-journal-integration.test.mjs`

**Interfaces:**
- Produces: `publish(change)`, `readBatch({ consumerId, projectId, limit })`, `ack({ consumerId, cursor })`, `invalidateProject(projectId)`, `snapshot()`.

- [ ] Write failing tests for coalescing, generation supersession, cursor monotonicity, failed-consumer non-ack and bounded retention.
- [ ] Run focused tests and confirm failure.
- [ ] Implement journal and scheduler hook that publishes normalized file generations.
- [ ] Re-run focused tests and confirm pass.
- [ ] Commit `feat: add shared intelligence journal`.

### Task 4: Harness Canary Controller

**Files:**
- Create: `src/providers/harness-canary-controller.mjs`
- Modify: `src/providers/adaptive-harness-lab.mjs`
- Test: `tests/harness-canary-controller.test.mjs`

**Interfaces:**
- Produces: `assign(scope)`, `recordOutcome(input)`, `evaluate(candidateId)`, `disable(candidateId, reason)`, `snapshot()`.

- [ ] Write failing tests for deterministic cohorts, percentage bounds, minimum samples, regression cutoff and no raw payload persistence.
- [ ] Run test and confirm failure.
- [ ] Implement controller and expose it from Adaptive Harness Lab.
- [ ] Re-run test and confirm pass.
- [ ] Commit `feat: add governed harness canaries`.

### Task 5: Browser Journey Evidence

**Files:**
- Create: `src/browser/browser-journey-recorder.mjs`
- Modify: `src/browser/playwright-cli-driver.mjs`
- Test: `tests/browser-journey-recorder.test.mjs`
- Test: `tests/playwright-journey-integration.test.mjs`

**Interfaces:**
- Produces: `record(input)`, `compare(previous, current)`, `snapshot()`.

- [ ] Write failing tests for DOM digest, a11y summary, console/network failures, project-contained artifact hashes and missing-video non-claim.
- [ ] Run focused tests and confirm failure.
- [ ] Implement recorder and optional driver journey capture hook.
- [ ] Re-run focused tests and confirm pass.
- [ ] Commit `feat: add browser journey evidence`.

### Task 6: Hosted Lifecycle State Machine

**Files:**
- Create: `src/orchestration/hosted-lifecycle-coordinator.mjs`
- Test: `tests/hosted-lifecycle-coordinator.test.mjs`

**Interfaces:**
- Consumes: least-privilege adapter methods `createBranch`, `createPullRequest`, `readCi`, `comment`, with explicit capability declarations.
- Produces: `start(input)`, `advance(id)`, `recordLocalVerification(id, receipt)`, `requestRepair(id, input)`, `snapshot(id)`.

- [ ] Write failing tests for legal transitions, external-gate result without adapter, CI failure repair limit and human merge gate.
- [ ] Run test and confirm failure.
- [ ] Implement immutable state machine and receipts.
- [ ] Re-run test and confirm pass.
- [ ] Commit `feat: add hosted lifecycle coordinator`.

### Task 7: Mission Resource Fabric Facade and Runtime Wiring

**Files:**
- Create: `src/runtime/mission-resource-fabric.mjs`
- Modify: `src/app.mjs`
- Modify: `src/server/routes.mjs`
- Modify: `src/server/http-server.mjs`
- Test: `tests/mission-resource-fabric.test.mjs`
- Test: `tests/mission-resource-fabric-app-wiring.test.mjs`
- Test: `tests/mission-resource-fabric-http-api.test.mjs`

**Interfaces:**
- Produces facade properties `processLedger`, `sessionHost`, `journal`, `canary`, `journeys`, `hostedLifecycle`; methods `publicView()`, `onGovernorSnapshot(snapshot)`, `close()`.

- [ ] Write failing tests for facade lifecycle, app composition budget, runtime projection and authenticated read-only API.
- [ ] Run focused tests and confirm failure.
- [ ] Implement facade and narrow wiring into provider, repository, browser and runtime snapshots.
- [ ] Re-run focused tests and confirm pass.
- [ ] Commit `feat: wire mission resource fabric`.

### Task 8: Mission / Work / Evidence UI Shell

**Files:**
- Modify: `ui/index.html`
- Modify: `ui/app.js`
- Modify: `ui/style.css`
- Create: `ui/mission-resource-fabric.js`
- Create: `ui/mission-resource-fabric.css`
- Test: `tests/mission-work-evidence-ui.test.mjs`
- Test: `tests/mission-resource-hud-ui.test.mjs`

**Interfaces:**
- Three primary shell buttons route to Mission, Work and Evidence; advanced center commands remain registered in Ctrl+K.

- [ ] Write failing static/UI tests for three primary buttons, advanced command reachability, resource HUD, bounded list rendering and pressure-aware CSS.
- [ ] Run focused tests and confirm failure.
- [ ] Implement grouped shell, contextual drawer links and resource HUD without removing existing centers.
- [ ] Re-run focused tests and confirm pass.
- [ ] Commit `feat: simplify mission work evidence shell`.

### Task 9: Release Runner Termination

**Files:**
- Modify: `scripts/run-node-test-suite.mjs`
- Test: `tests/node-test-runner-clean-exit.test.mjs`

**Interfaces:**
- Runner must close child streams/timers, detect lingering children and exit with the aggregate status after all scheduled files finish.

- [ ] Write a failing test that invokes the runner on a tiny fixture and requires clean exit.
- [ ] Run test and confirm failure or timeout.
- [ ] Implement child cleanup and explicit bounded finalization without masking failures.
- [ ] Re-run test and confirm pass.
- [ ] Commit `fix: make node suite terminate cleanly`.

### Task 10: 2.19 Release Gate, Measurement and Artifacts

**Files:**
- Create: `scripts/measure-mission-resource-fabric.mjs`
- Create: `src/release/mission-resource-fabric-verifier.mjs`
- Create: `scripts/verify-mission-resource-fabric.mjs`
- Modify: `scripts/full-release-matrix.mjs`
- Modify: `scripts/package-release-artifacts.mjs`
- Modify: `scripts/update-release-tools.mjs`
- Modify: versioned docs/config/package files generated by existing release tooling.
- Test: `tests/mission-resource-fabric-release-gate.test.mjs`

**Interfaces:**
- Measurement schema: `forge.studio.mission-resource-fabric-measurement.v1`.

- [ ] Write failing release-gate test requiring the verifier, measurement, matrix gate and explicit limitations.
- [ ] Run focused test and confirm failure.
- [ ] Implement deterministic synthetic measurement and verifier.
- [ ] Update version to 2.19.0 and regenerate release docs/manifests.
- [ ] Run focused tests, architecture gates and `npm test`.
- [ ] Run `FORGE_NOLANE_NATIVE_PACK_PATH=/mnt/data/ForgeStudio-LegacyExternalRuntime-2.18.0.zip npm run release:matrix` from a clean commit.
- [ ] Fix every failure at root cause and repeat until all mandatory gates pass.
- [ ] Package source, Windows x64, update payload, VSIX, NolaneNative optional pack, evidence and change set.
- [ ] Verify SHA-256, archive structure, Git commit and clean tree.
- [ ] Commit `release: Forge Studio 2.19.0`.
