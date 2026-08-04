# Forge Studio 3.2 Verified Mission Runtime Design

## Goal

Close 13 high-value `partial` requirements in Forge Studio 3.1.0 by making mission success, decision confidence, context usefulness, resource cost, and process cleanup verifiable from immutable evidence rather than caller assertions.

## Scope

This release implements requirements `29.3`, `29.8`, `29.13`, `29.14`, `29.16`, `34.9`, `34.11`, `34.12`, `34.13`, `34.14`, `40.4`, `40.12`, and `40.18`.

## Non-goals

- No cloud sandbox, hosted provider, pull-request creation, merge, deployment, production policy learning, or benchmark superiority claim.
- No chain-of-thought, raw prompt, raw model output, credential, environment dump, or unbounded terminal log persistence.
- No confidence increase from self-reported tool success, low token usage, or an unverified patch.
- No platform claim beyond drivers that are directly exercised by the release runner. Unsupported process-tree capabilities remain explicit.

## Architecture

### 1. Verified Outcome Ledger

`VerifiedOutcomeLedger` owns a bounded hierarchy of mission, milestone, task, decision, and criterion identities. Verification receipts are the only inputs that can add verified value. The ledger computes `verifiedCriteriaScore` at task, milestone, and mission levels and preserves exact contributing receipt hashes.

Context usefulness is not accepted as a free numeric field. A context card becomes objectively useful only when a passing verification receipt links the card to at least one verified criterion, failed-hypothesis elimination, or independently observed effect. The ledger reports selected, useful, unused, and contradicted token counts from card-level token receipts.

Every token, tool, model, process, and context cost observation must contain a `decisionId`. The ledger aggregates cost by decision, task, milestone, and mission while retaining source receipt hashes. Missing or unknown decision identities fail closed.

A correctness-first objective gate orders candidates lexicographically: verified requirement score, regression-free status, verification integrity, then resource cost. A cheaper candidate cannot win by skipping verification, weakening tests, reducing acceptance criteria, hiding regressions, or omitting cost sources. The gate emits explicit reward-hacking reasons.

### 2. Effect and Confidence Runtime

`ToolEffectVerifier` compares declared expected effects with independently observed actual effects using bounded path assertions, set membership, numeric tolerances, and receipt-backed probes. Exit code zero or a tool-provided `success` flag is insufficient. A mismatch produces `false_success`; missing independent evidence produces `inconclusive`; only matching independent evidence produces `verified`.

`ConfidenceCalibrationService` maintains separate lanes for requirement understanding, retrieval, hypothesis, plan, execution, patch, and verification. Updates require verified outcomes. Calibration is conditioned by domain and task kind and uses bounded Beta counts rather than opaque model weights. Final confidence is computed from the weakest calibrated lane plus a capped independent-evidence bonus; no average may hide a critically weak lane.

### 3. Decision State Machine and Progress Detection

`DecisionStateMachine` enforces `specified → proposed → verified → authorized → executed → observed → committed`, with explicit `rejected`, `rolled_back`, and `aborted` terminals. Each transition declares its required receipt type. Invalid skips, duplicate execution, commit before observed effect, and transition after terminal state fail closed.

`SemanticProgressDetector` evaluates progress windows from four objective deltas: verified criteria, test result, semantic diff, and information gain. Repeated action fingerprints, unchanged verification receipts, churn-only diffs, and tool activity without positive deltas produce a no-progress decision. A single passing but duplicate receipt is not new progress.

### 4. Resource Evidence and Process Reaping

`ResourceAttributionLedger` integrates sampled RSS over time into `rssMbSeconds` and attributes it to resource, decision, task, milestone, and mission. Samples are monotonic per resource, source-receipted, and bounded. Replayed or out-of-order samples cannot double count.

`DiskBackedRawLog` writes redacted, length-prefixed JSON records to disk. RAM retains only stream summaries, byte offsets, record counts, cursors, and rolling receipt hashes. Reads are bounded by offset and byte/record limits. Secret-like keys and values are rejected or redacted before persistence.

`ProcessLeakReaper` compares registered mission process trees with live driver observations. On mission stop it sends graceful termination, re-samples, escalates remaining descendants, and records every killed or already-exited PID. Unknown processes outside the registered trees are never killed. A driver without kill-tree capability returns an explicit unsupported receipt rather than pretending cleanup succeeded.

### 5. Integration

A lazy `VerifiedMissionRuntime` composes the seven focused services and is owned by `DecisionPlane`. Existing fast paths do not instantiate it. `MissionResourceFabric` delegates mission outcome, progress, resource sample, raw-log, and cleanup operations to the same runtime so decision and resource evidence share identities.

`CognitiveKernel.verify` invokes `ToolEffectVerifier` for expected/actual effect comparisons and stores the effect receipt. `CognitiveKernel.commit` blocks `false_success` and `inconclusive` proposals. Existing callers that provide no expected effect remain compatible but receive an explicit `not_applicable` effect status.

### 6. Release Certification

A deterministic measurement exercises all 13 behaviors, including an actual child-process tree on the Linux release runner. Mandatory gate `verified-mission-runtime` checks source, direct tests, integration, measurement receipt, audit transitions, non-claims, bounded disk logging, and cleanup evidence. The audit generator promotes exactly the 13 scoped IDs; all other partial and external statuses remain unchanged.

## Data Flow

1. Criteria and mission hierarchy are registered with stable IDs.
2. A decision is created and all context/cost observations reference its `decisionId`.
3. Tool execution moves through the verified state machine.
4. Independent probes compare expected and actual effects.
5. Passing verification updates criterion scores, context usefulness, and calibration lanes.
6. Resource samples update hierarchical `rssMbSeconds`; raw events are appended to disk while RAM retains cursors only.
7. Progress windows decide whether the mission is advancing or looping.
8. Mission stop reaps only registered process trees and records cleanup receipts.
9. Release measurement and gate certify behavior on the exact release commit.

## Error Handling and Safety

- All IDs, arrays, paths, log records, samples, state histories, and evidence sets are bounded.
- Public outputs are canonical, deeply frozen, content-addressed, and privacy-safe.
- Unknown decision IDs, invalid SHA-256 receipts, stale/out-of-order samples, duplicate verification, invalid state transitions, effect mismatches, and missing driver capabilities fail closed.
- Raw logs reject path traversal and never expose arbitrary filesystem reads.
- Cleanup never kills a PID not proven to belong to a registered mission tree.
- Learning/calibration cannot consume failed, ambiguous, synthetic, or self-asserted outcomes.

## Testing

- Unit tests for hierarchy scores, objective context usefulness, cost attribution, correctness-first ordering, and reward-hacking detection.
- Unit and integration tests for effect verification, lane calibration, weakest-link confidence, state transitions, and semantic no-progress.
- Unit tests for RSS integration, disk-backed cursors/redaction, out-of-order sample rejection, and process-tree cleanup.
- Cognitive Kernel and Mission Resource Fabric integration tests.
- Measurement, mandatory release gate, audit transition, version coherence, historical gate regression, full Node suite, full release matrix, packaging, archive reconstruction, and checksums.

## Honest Status Policy

Forge Studio 3.2.0 may claim deterministic local implementations of the 13 scoped requirements on the directly tested release platform. It may not claim universal cross-platform process enforcement, production provider truthfulness, perfect semantic progress detection, real-world benchmark superiority, or autonomous safe operation without human and external infrastructure gates.
