# Forge Studio 3.2 Verified Mission Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement and certify 13 P0 partial requirements for verified mission outcomes, cognitive integrity, resource attribution, disk-backed logs, and process cleanup.

**Architecture:** Add focused immutable ledgers and verifiers, compose them in a lazy `VerifiedMissionRuntime`, integrate effect checking into `CognitiveKernel`, and expose mission-level operations through `DecisionPlane` and `MissionResourceFabric`. Certify exactly 13 audit transitions with a deterministic measurement and required release gate.

**Tech Stack:** Node.js ESM, `node:test`, canonical JSON/SHA-256 utilities, filesystem append/read APIs, existing platform process drivers, existing release/audit tooling.

## Global Constraints

- Version target is `3.2.0` from clean commit `d03cd371ef63d917d7793df17792dc6958a58842`.
- Promote only IDs `29.3`, `29.8`, `29.13`, `29.14`, `29.16`, `34.9`, `34.11`, `34.12`, `34.13`, `34.14`, `40.4`, `40.12`, and `40.18`.
- Do not alter the 63 external-gate requirements.
- Verified value and calibration updates require passing independent verification receipts.
- No raw prompts, model outputs, chain-of-thought, credentials, environment dumps, arbitrary filesystem reads, or unbounded logs.
- No process outside a registered mission tree may be killed.
- Every public result is bounded, deeply frozen, canonical, and content-addressed.
- No benchmark or cross-platform superiority claim.

---

### Task 1: Verified outcome hierarchy and context usefulness

**Files:**
- Create: `src/decision/verified-outcome-ledger.mjs`
- Test: `tests/verified-outcome-ledger.test.mjs`

**Interfaces:**
- Produces: `registerMission(input)`, `registerMilestone(input)`, `registerTask(input)`, `registerDecision(input)`, `recordContextSelection(input)`, `recordVerification(input)`, `recordCost(input)`, `score(scope)`, `contextUtility(scope)`, `cost(scope)`, `snapshot()`.

- [ ] Write failing tests for stable mission/milestone/task/decision hierarchy and criterion weights.
- [ ] Write failing tests proving only passing receipt-backed verification increases task, milestone, and mission scores.
- [ ] Write failing tests deriving useful context tokens from criterion/effect/hypothesis links and rejecting caller-supplied usefulness totals.
- [ ] Write failing tests requiring every cost observation to reference a known decision and aggregating token/tool/model/process/context cost through all scopes.
- [ ] Run RED: `node --test tests/verified-outcome-ledger.test.mjs`.
- [ ] Implement bounded immutable ledgers, exact receipt validation, idempotency, and signed projections.
- [ ] Run GREEN: `node --test tests/verified-outcome-ledger.test.mjs tests/acceptance-criteria-ledger.test.mjs tests/decision-efficiency-metrics.test.mjs`.
- [ ] Commit: `feat(decision): add verified outcome hierarchy`.

### Task 2: Correctness-first objective and reward-hacking guard

**Files:**
- Create: `src/decision/correctness-first-objective.mjs`
- Test: `tests/correctness-first-objective.test.mjs`
- Modify: `src/decision/decision-efficiency-metrics.mjs`

**Interfaces:**
- Produces: `evaluateCandidate(input)`, `rankCandidates(candidates)`, `detectRewardHacking(candidate, baseline)`.
- `computeDecisionEfficiency` consumes a ledger-derived outcome snapshot and `decisionId` rather than trusting free usefulness fields.

- [ ] Write failing tests that rank verified requirements before regression status, verification integrity, and only then resource cost.
- [ ] Write failing tests for skipped verification, weakened tests, reduced criteria, hidden regressions, missing cost categories, and fake low-token wins.
- [ ] Run RED: `node --test tests/correctness-first-objective.test.mjs tests/decision-efficiency-metrics.test.mjs`.
- [ ] Implement lexicographic ordering and explicit reward-hacking receipts.
- [ ] Update decision efficiency to include `decisionId`, task/milestone/mission verified scores, and objective context usefulness from ledger receipts.
- [ ] Run GREEN and release-gate regressions.
- [ ] Commit: `feat(decision): enforce correctness-first optimization`.

### Task 3: Tool effect verifier

**Files:**
- Create: `src/cognition/tool-effect-verifier.mjs`
- Test: `tests/tool-effect-verifier.test.mjs`
- Modify: `src/cognition/cognitive-kernel.mjs`
- Modify: `tests/cognitive-decision-plane-integration.test.mjs`

**Interfaces:**
- Produces: `verify(input)` with statuses `verified`, `false_success`, `inconclusive`, or `not_applicable`.
- `CognitiveKernel.verify()` stores `effectVerification`; `commit()` rejects false or inconclusive effects when an expected effect exists.

- [ ] Write failing tests for path equality, numeric tolerance, set inclusion, independent probe receipts, false-success detection, and inconclusive evidence.
- [ ] Run RED: `node --test tests/tool-effect-verifier.test.mjs`.
- [ ] Implement bounded effect assertions with no code execution or arbitrary expressions.
- [ ] Integrate into Cognitive Kernel while preserving no-effect compatibility.
- [ ] Run GREEN and cognitive regressions.
- [ ] Commit: `feat(cognition): verify actual tool effects`.

### Task 4: Confidence calibration and weakest-link final confidence

**Files:**
- Create: `src/cognition/confidence-calibration-service.mjs`
- Test: `tests/confidence-calibration-service.test.mjs`

**Interfaces:**
- Produces: `recordOutcome(input)`, `calibrate(input)`, `finalConfidence(input)`, `snapshot()` for seven named lanes.

- [ ] Write failing tests for separate lane/domain/task-kind Beta calibration and verified-only updates.
- [ ] Write failing tests proving final confidence uses the weakest lane plus a capped independent-evidence bonus.
- [ ] Write failing tests preventing duplicated/correlated evidence from increasing the bonus.
- [ ] Run RED.
- [ ] Implement bounded calibration tables, evidence-family deduplication, and signed outputs.
- [ ] Run GREEN and trajectory confidence regressions.
- [ ] Commit: `feat(cognition): calibrate confidence by decision lane`.

### Task 5: Decision state machine and semantic progress detector

**Files:**
- Create: `src/cognition/decision-state-machine.mjs`
- Create: `src/cognition/semantic-progress-detector.mjs`
- Test: `tests/decision-state-machine.test.mjs`
- Test: `tests/semantic-progress-detector.test.mjs`

**Interfaces:**
- State machine: `create(input)`, `transition(decisionId,input)`, `snapshot(decisionId)`.
- Progress detector: `observe(input)`, `evaluate(scope)`, `snapshot(scope)`.

- [ ] Write failing state tests for all valid transitions, required receipt kinds, terminal states, invalid skips, duplicate execution, and commit-before-observation.
- [ ] Write failing progress tests for verified criteria delta, test delta, semantic diff delta, information gain, duplicate receipts, repeated action fingerprints, and churn-only diffs.
- [ ] Run RED.
- [ ] Implement deterministic transition tables and bounded progress windows.
- [ ] Run GREEN and mission-progress regressions.
- [ ] Commit: `feat(cognition): add verified decision flow and progress detection`.

### Task 6: Hierarchical resource attribution

**Files:**
- Create: `src/runtime/resource-attribution-ledger.mjs`
- Test: `tests/resource-attribution-ledger.test.mjs`
- Modify: `src/runtime/mission-process-ledger.mjs`

**Interfaces:**
- Produces: `registerResource(input)`, `sample(input)`, `finalize(input)`, `snapshot(scope)` with resource/decision/task/milestone/mission `rssMbSeconds`.

- [ ] Write failing tests for trapezoidal RSS integration, hierarchy aggregation, monotonic sample time, idempotent sample receipts, and out-of-order rejection.
- [ ] Run RED.
- [ ] Implement bounded sample journals and signed hierarchical projections.
- [ ] Add `rssMbSeconds` and sample timing to Mission Process Ledger without changing unsupported FD semantics.
- [ ] Run GREEN and resource regressions.
- [ ] Commit: `feat(runtime): attribute rss time across mission scopes`.

### Task 7: Disk-backed raw logs

**Files:**
- Create: `src/runtime/disk-backed-raw-log.mjs`
- Test: `tests/disk-backed-raw-log.test.mjs`

**Interfaces:**
- Produces: `append(streamId,record)`, `read(streamId,options)`, `snapshot(streamId?)`, `close()`.

- [ ] Write failing tests proving raw records are on disk while snapshots retain only summaries/cursors/offsets.
- [ ] Write failing tests for redaction, record/byte bounds, path traversal rejection, restart recovery, checksum chain verification, and truncated-tail handling.
- [ ] Run RED.
- [ ] Implement length-prefixed canonical JSON append logs with per-stream files and rolling receipts.
- [ ] Run GREEN.
- [ ] Commit: `feat(runtime): persist bounded raw logs on disk`.

### Task 8: Orphan and leaked process reaper

**Files:**
- Create: `src/runtime/process-leak-reaper.mjs`
- Test: `tests/process-leak-reaper.test.mjs`
- Modify: `src/sandbox/platform-resource-driver.mjs`
- Modify: `src/execution/managed-process-registry.mjs`

**Interfaces:**
- Produces: `reapMission(input)` with graceful/escalated/already-exited/unsupported results.
- Platform driver adds `killTree(rootPid,{ signal })` and `isTreeAlive(rootPid)` where supported.

- [ ] Write failing driver tests for real child/grandchild cleanup on Linux and explicit unsupported behavior on fake drivers.
- [ ] Write failing safety tests proving unrelated PIDs are never killed and stale/reused root PIDs require identity evidence.
- [ ] Run RED.
- [ ] Implement Linux process-group/tree cleanup, bounded re-sampling, escalation, and receipts.
- [ ] Integrate Managed Process Registry cleanup through the driver contract.
- [ ] Run GREEN and managed-process regressions.
- [ ] Commit: `feat(runtime): reap registered mission process trees`.

### Task 9: Lazy Verified Mission Runtime integration

**Files:**
- Create: `src/runtime/verified-mission-runtime.mjs`
- Test: `tests/verified-mission-runtime.test.mjs`
- Modify: `src/decision/decision-plane.mjs`
- Modify: `src/runtime/mission-resource-fabric.mjs`
- Test: `tests/verified-mission-runtime-integration.test.mjs`

**Interfaces:**
- Exposes bounded wrappers for outcome registration, objective ranking, calibration, state transitions, progress, resource samples, logs, and cleanup.

- [ ] Write failing tests proving the runtime is lazy, shares mission identities across decision/resource services, closes disk/process resources, and does not load on legacy fast paths.
- [ ] Run RED.
- [ ] Implement composition and DecisionPlane/MissionResourceFabric wrappers.
- [ ] Run GREEN and app/fabric regressions.
- [ ] Commit: `feat(runtime): integrate verified mission runtime`.

### Task 10: Measurement, gate, audit, and release 3.2.0

**Files:**
- Create: `scripts/measure-verified-mission-runtime.mjs`
- Create: `src/release/verified-mission-runtime-verifier.mjs`
- Create: `scripts/verify-verified-mission-runtime.mjs`
- Create: `tests/verified-mission-runtime-release-gate.test.mjs`
- Modify: `src/release/full-release-matrix.mjs`
- Modify: `tests/full-release-matrix.test.mjs`
- Modify: `scripts/generate-frontier-feature-audit.mjs`
- Modify: version surfaces, release docs, limitations, and project manifest.

**Interfaces:**
- Produces gate `verified-mission-runtime`, `docs/verified-mission-runtime-measurement-3.2.0.json`, coherent 3.2.0 audit/report/docs, and exact 13-item promotion.

- [ ] Write failing gate tests for direct source/tests, deterministic measurement, actual child-tree cleanup, disk log evidence, exact audit transitions, unchanged external count, and non-claims.
- [ ] Run RED.
- [ ] Implement measurement, verifier, matrix registration, and audit rules.
- [ ] Update all version surfaces and generate 3.2.0 reports.
- [ ] Run direct gate, version coherence, audit count, and historical architecture gate regressions.
- [ ] Commit: `chore(release): prepare Forge Studio 3.2.0`.

### Task 11: Full verification, packaging, and export

**Files:**
- Generated under `release/` and exported to `/mnt/data`.
- Modify: `project-manifest.json`.

**Interfaces:**
- Produces source ZIP, Windows/Electron ZIP, update payload ZIP, VSIX, evidence ZIP, change-set ZIP, full matrix MD/JSON, release manifest/integrity, and SHA-256 list.

- [ ] Run `npm test` on the clean release commit.
- [ ] Run `npm run release:matrix` and require every gate to pass on the same commit.
- [ ] Build canonical release artifacts without inventing unsupported packages.
- [ ] Update `project-manifest.json` for files created or changed in this response.
- [ ] Verify archive reconstruction, checksums, version identity, matrix receipt, audit counts, and clean Git status.
- [ ] Export all created/changed artifacts to `/mnt/data` and expose them to the user.
