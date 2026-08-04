# Forge Studio 2.27.0 Collaboration & Experience Plane Design

## Goal

Build a local-first collaboration plane that lets multiple agents share versioned facts and commitments, select the smallest useful coordination topology, detect semantic integration conflicts, replay browser journeys deterministically, and expose the same mission/evidence state through the web workroom and VS Code without increasing the composition-root budget.

## Scope

This release covers frontier requirement groups 41, 42, and 44. It does not claim production JetBrains parity, cross-platform visual-oracle certification, or benchmark superiority over external products.

## Architecture

The release adds one lazy `CollaborationExperiencePlane` behind the existing `DecisionPlane`. The plane owns four focused subsystems:

1. **Coordination core** — typed blackboard, belief store, commitment ledger, topology selector, fencing leases, deadlock detection, wave control, handoff receipts, and coordination metrics.
2. **Semantic integration** — symbol/path ownership and semantic merge analysis using exact graph evidence, public API assumptions, duplicated logic fingerprints, and verification contracts.
3. **Browser evidence** — versioned journey scripts, deterministic replay, environment reset, bounded computer actions, injection screening, network policy, repeated-replay flake detection, and artifact playback receipts.
4. **Experience surfaces** — review queue, artifact playback, steering commands, role projections, performance/accessibility budgets, and a VS Code state bridge.

All subsystems use canonical JSON receipts and bounded public snapshots. Prompt text, chain-of-thought, cookies, authorization headers, passwords, clipboard secrets, and raw downloaded content are not stored.

## Coordination Core

### Typed Shared Blackboard

Entries use the schema:

- `entryId`, `kind`, `key`, `valueSummary`, `artifactSha256`
- `agentId`, `domain`, `confidence`, `provenance`
- `version`, `fencingToken`, `createdAt`, `expiresAt`
- `supports`, `contradicts`, `ownership`

Writes require the current fencing token. Stale writers are rejected. Conflicting entries are resolved by provenance class, confidence, freshness, and verification state; unresolved conflict is retained rather than silently overwritten.

### Beliefs and Commitments

Beliefs remain separated by agent and domain. A `JointCommitmentLedger` stores shared goal, agent role, protected interface, dependency, handoff criteria, and renegotiation state. A public-contract change blocks dependent agents until all affected commitments acknowledge the new revision.

### Adaptive Topology

The selector chooses one of:

- solo
- planner–executor
- executor–adversarial reviewer
- parallel candidates
- debate
- hierarchy
- blackboard

Selection is based on task risk, subtask independence, uncertainty, expected information gain, communication cost, and resource pressure. It never creates additional agents when work is not independent or the resource plane denies admission.

### Lifecycle and Coordination Metrics

Agent leases include heartbeat, TTL, fencing token, owned symbols/paths, and commitment revision. Deadlock detection builds a wait-for graph and finds cycles or stalled commitments. Wave control supports revoke, reassign, and reconcile. Metrics include routing regret, coordination overhead, conflict rate, deadlock count, stale-write rejection, and useful parallelism.

## Semantic Merge

`SemanticMergeAnalyzer` accepts candidate changes and exact repository intelligence evidence. It detects:

- overlapping symbol or path ownership
- incompatible public API assumptions
- contract/version mismatch
- duplicated logic fingerprints
- behavior conflict despite clean Git merge
- dependent test expectations that disagree

High-confidence critical findings block integration. Ambiguous findings remain non-blocking but must appear in the review queue. The analyzer does not claim full program equivalence or complete semantic conflict detection.

## Deterministic Browser Replay

A journey script is a versioned list of bounded actions: navigate, click, type, select, keyboard, drag, upload, wait, assert, screenshot, and checkpoint. Each action has a stable selector, timeout, expected state, and permission scope.

Replay requires:

- clean cookie/storage/service-worker state unless reuse is explicitly safe
- deterministic seed and environment fingerprint
- network allowlist and download-execution deny-by-default
- DOM, accessibility, console, network, and assertion receipts
- screenshot/video artifact hashes
- repeated replays for flake detection
- divergence receipt when state fingerprints differ

Page, DOM, clipboard, and download content pass through prompt-injection screening and secret redaction. Screenshots are evidence artifacts, not sufficient proof of product correctness. Visual regression with human-approved baselines remains partial unless a reviewed baseline is supplied.

## Agent-Native Experience

The three primary shells remain `Mission`, `Work`, and `Evidence`.

New shared-state views:

- **Review Queue** grouped by risk, dependency, mission stage, and unresolved evidence.
- **Artifact Playback** showing commands, files, browser actions, checkpoints, and receipts with rewind targets.
- **Steering Controls** for pause, redirect, reprioritize, revoke, and resume.
- **Role Projections** for builder, reviewer, and operator using the same underlying state.
- **Device Impact Preview** before enabling browser, LSP, embedding, or additional agents.

Large lists, logs, graphs, and diffs are virtualized. UI respects keyboard navigation, screen-reader labels, contrast requirements, `prefers-reduced-motion`, and resource-pressure reduced effects. The design uses spacing, hierarchy, and progressive disclosure instead of blur-heavy decoration.

### VS Code

The extension receives a bounded mission snapshot containing mission state, diagnostics, tests, review queue, changed symbols, and artifact links. It can request pause, resume, redirect, and review actions through the local API. Inline diff application remains governed by existing patch and permission services.

JetBrains parity is explicitly outside the verified scope of 2.27.0.

## Error Handling

- stale blackboard or worker write → fail with fencing receipt
- public contract revision mismatch → block and require renegotiation
- deadlock/circular wait → pause affected commitments and recommend revoke/reassign
- browser divergence → stop replay and emit divergence receipt
- injection/secret detection → redact or block before model/context ingestion
- unavailable UI/IDE capability → report partial/external gate, never silently claim support

## Testing

Every production module is introduced with RED→GREEN tests. Required integration evidence:

- shared-state conflict and stale writer rejection
- commitment renegotiation and deadlock resolution
- topology selection under risk/resource constraints
- semantic merge conflict and clean candidate acceptance
- deterministic replay, isolation, redaction, flake detection, and divergence
- review queue ordering, playback rewind, steering authorization, accessibility/performance budgets
- VS Code mission-state bridge and governed command forwarding
- lazy plane lifecycle and unchanged `src/app.mjs` composition budget

## Release Gates

Two new required gates:

- `multi-agent-collaboration`
- `browser-experience-surface`

The gates verify source behavior, direct tests, integration measurement, audit transition, limitations, and non-claims. They do not use external-provider fixtures to claim real swarm or cross-platform superiority.
