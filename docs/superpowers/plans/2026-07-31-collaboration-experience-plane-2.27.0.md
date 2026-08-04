# Forge Studio 2.27.0 Collaboration & Experience Plane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add versioned multi-agent coordination, semantic integration checks, deterministic browser replay, and shared web/VS Code experience surfaces without increasing startup composition weight.

**Architecture:** Implement focused coordination, browser, and experience modules behind a lazy `CollaborationExperiencePlane`, then expose bounded snapshots through `DecisionPlane`, HTTP APIs, the web workroom, and VS Code. Existing subagent, repository intelligence, browser journey, verification, resource, and patch services remain authoritative.

**Tech Stack:** Node.js ESM, SQLite/file-backed stores where persistence is required, canonical JSON SHA-256 receipts, dependency-free browser UI, TypeScript VS Code extension, Node test runner.

## Global Constraints

- Keep `src/app.mjs` at or below 160 static imports and 180 constructor expressions.
- No raw prompt, chain-of-thought, cookie, password, authorization header, clipboard secret, or unbounded page/download content in receipts.
- No claim of production JetBrains parity, visual oracle completeness, cross-platform computer-use certification, or superiority over external agents.
- New stateful services must be lazy and closable.
- Every new production behavior follows RED → GREEN → regression → commit.
- Audit remains exactly 1,150 requirements and version-aware.

---

### Task 1: Typed Shared Blackboard and Belief Store

**Files:**
- Create: `src/collaboration/shared-blackboard.mjs`
- Create: `tests/shared-blackboard.test.mjs`

**Interfaces:**
- Produces: `SharedBlackboard.write(input)`, `read(query)`, `resolve(key)`, `heartbeat(input)`, `snapshot()`.

- [ ] Write tests for versioned writes, stale fencing rejection, TTL expiry, provenance/confidence conflict resolution, and per-agent beliefs.
- [ ] Run `node --test --test-force-exit tests/shared-blackboard.test.mjs` and verify missing-module failure.
- [ ] Implement canonical receipts, bounded entries, conflict retention, and public snapshots.
- [ ] Re-run the test and commit `feat(collaboration): add typed shared blackboard`.

### Task 2: Joint Commitment Ledger and Deadlock Recovery

**Files:**
- Create: `src/collaboration/joint-commitment-ledger.mjs`
- Create: `tests/joint-commitment-ledger.test.mjs`

**Interfaces:**
- Produces: `create`, `acknowledge`, `renegotiate`, `handoff`, `waitFor`, `detectDeadlocks`, `revoke`, `reassign`, `snapshot`.

- [ ] Write tests proving public-contract change requires affected acknowledgements, structured handoff validates artifact hash and verification receipt, circular wait is detected, and revoke/reassign resolves the cycle.
- [ ] Run the test and verify RED.
- [ ] Implement revisioned commitments, wait-for graph, deadlock receipts, and wave reconciliation.
- [ ] Re-run and commit `feat(collaboration): add joint commitment governance`.

### Task 3: Adaptive Topology, Trust, Ownership, and Credit

**Files:**
- Create: `src/collaboration/adaptive-topology-selector.mjs`
- Create: `src/collaboration/coordination-metrics.mjs`
- Create: `tests/adaptive-topology-selector.test.mjs`
- Modify: `src/agents/subagent-orchestrator.mjs`

**Interfaces:**
- Produces: `selectTopology(input)`, `DomainTrustRegistry`, `assignCredit(input)`, and orchestrator ownership/fencing hooks.

- [ ] Write tests for solo on low-risk dependent work, candidates for independent high-risk work, adversarial review for security, resource-denied swarm fallback, domain-conditioned reviewer trust, symbol ownership, and counterfactual credit.
- [ ] Run tests and verify RED.
- [ ] Implement bounded scoring and expose coordination receipts without creating agents automatically.
- [ ] Extend subagent jobs with lease/fencing/heartbeat and exact symbol ownership verification.
- [ ] Re-run regressions and commit `feat(collaboration): add adaptive topology and credit`.

### Task 4: Semantic Merge Analyzer

**Files:**
- Create: `src/collaboration/semantic-merge-analyzer.mjs`
- Create: `tests/semantic-merge-analyzer.test.mjs`

**Interfaces:**
- Produces: `analyze({ candidates, graphEdges, apiContracts, testContracts })`.

- [ ] Write tests for clean textual merge with incompatible API assumptions, duplicate logic, shared-symbol behavior conflict, ambiguous evidence, and safe candidates.
- [ ] Run and verify RED.
- [ ] Implement provenance-aware findings and blocking thresholds.
- [ ] Re-run and commit `feat(collaboration): detect semantic merge conflicts`.

### Task 5: Deterministic Browser Journey Replay

**Files:**
- Create: `src/browser/deterministic-journey-replayer.mjs`
- Create: `src/browser/browser-injection-guard.mjs`
- Modify: `src/browser/browser-journey-recorder.mjs`
- Modify: `src/browser/browser-agent-service.mjs`
- Create: `tests/deterministic-journey-replayer.test.mjs`
- Create: `tests/browser-injection-guard.test.mjs`

**Interfaces:**
- Produces: `replay(script, adapter, options)`, `screenBrowserContent(input)`, versioned action scripts, divergence and flake receipts.

- [ ] Write tests for action validation, cookie/storage/service-worker reset, network allowlist, download deny, secret redaction, injection blocking, deterministic fingerprint, repeated replay flake detection, and screenshot/video hashes.
- [ ] Run and verify RED.
- [ ] Implement adapter-driven replay and bounded receipts.
- [ ] Re-run browser regressions and commit `feat(browser): add deterministic journey replay`.

### Task 6: Review Queue, Playback, and Steering Core

**Files:**
- Create: `src/experience/review-queue-service.mjs`
- Create: `src/experience/artifact-playback-service.mjs`
- Create: `src/experience/mission-steering-service.mjs`
- Create: `tests/review-queue-service.test.mjs`
- Create: `tests/artifact-playback-service.test.mjs`
- Create: `tests/mission-steering-service.test.mjs`

**Interfaces:**
- Produces risk/dependency ordering, checkpoint rewind plans, and governed pause/redirect/reprioritize/revoke/resume receipts.

- [ ] Write tests for risk grouping, dependency blocking, hunk/file/command/capability decisions, bounded playback, rewind target validation, and steering permission checks.
- [ ] Run and verify RED.
- [ ] Implement public-state services and commit `feat(experience): add review playback and steering`.

### Task 7: Collaboration Experience Plane and Runtime Wiring

**Files:**
- Create: `src/runtime/collaboration-experience-plane.mjs`
- Modify: `src/decision/decision-plane.mjs`
- Modify: `src/agent/agent-loop.mjs`
- Create: `tests/collaboration-experience-plane.test.mjs`
- Create: `tests/collaboration-decision-plane-integration.test.mjs`

**Interfaces:**
- Produces lazy wrappers for Tasks 1–6 and a bounded lifecycle snapshot.

- [ ] Write tests proving fast path remains unloaded, demand loads only required services, close is idempotent, and snapshots contain no private reasoning or secrets.
- [ ] Run and verify RED.
- [ ] Implement facade and DecisionPlane/AgentLoop integration without direct `app.mjs` import.
- [ ] Run composition regressions and commit `feat(runtime): wire collaboration experience plane lazily`.

### Task 8: Web Workroom Experience

**Files:**
- Create: `ui/collaboration-experience.js`
- Create: `ui/collaboration-experience.css`
- Modify: `ui/index.html`
- Modify: `ui/app.js`
- Modify: `ui/style.css`
- Create: `tests/collaboration-experience-ui.test.mjs`

**Interfaces:**
- Consumes bounded collaboration snapshot and steering/review endpoints.
- Produces Review Queue, Artifact Playback, role projection, and steering controls within Mission/Work/Evidence.

- [ ] Write DOM/source tests for three-shell preservation, keyboard navigation, ARIA labels, virtualization, reduced motion, pressure-aware effects, and absence of heavy blur.
- [ ] Run and verify RED.
- [ ] Implement progressive-disclosure panels and performance budgets.
- [ ] Re-run existing UI tests and commit `feat(ui): add collaboration experience surfaces`.

### Task 9: VS Code State Bridge

**Files:**
- Create: `extensions/vscode/src/mission-state.ts`
- Modify: `extensions/vscode/src/client.ts`
- Modify: `extensions/vscode/src/extension.ts`
- Modify: `extensions/vscode/src/vscode.d.ts`
- Create: `tests/vscode-mission-state-bridge.test.mjs`

**Interfaces:**
- Produces bounded mission state, diagnostics/tests/review tree data, artifact links, and governed steering commands.

- [ ] Write tests for bounded state parsing, inline diagnostic/test projection, changed-symbol links, review commands, and rejection of raw prompt/output fields.
- [ ] Run and verify RED.
- [ ] Implement bridge, build extension, and commit `feat(vscode): add mission state and steering bridge`.

### Task 10: HTTP APIs and Evidence Integration

**Files:**
- Modify: `src/routes.mjs`
- Modify: `src/client/forge-studio-client.mjs`
- Create: `tests/collaboration-experience-http-api.test.mjs`

**Interfaces:**
- Produces local endpoints for snapshot, review decision, playback, and steering.

- [ ] Write auth/capability tests, bounded-payload tests, and secret-field rejection tests.
- [ ] Run and verify RED.
- [ ] Wire endpoints through existing local policy and capability services.
- [ ] Re-run HTTP regressions and commit `feat(api): expose governed collaboration experience endpoints`.

### Task 11: Release Measurement, Audit, and Gates

**Files:**
- Create: `scripts/measure-collaboration-experience.mjs`
- Create: `src/release/collaboration-experience-verifier.mjs`
- Create: `scripts/verify-collaboration-experience.mjs`
- Modify: `scripts/generate-frontier-feature-audit.mjs`
- Modify: `src/release/full-release-matrix.mjs`
- Create: `tests/collaboration-experience-release-gate.test.mjs`
- Create: `docs/collaboration-experience-measurement-2.27.0.json`

**Interfaces:**
- Adds required gates `multi-agent-collaboration` and `browser-experience-surface`.

- [ ] Write failing release-gate tests for source behavior, measurement, audit transition, privacy, composition, and non-claims.
- [ ] Implement deterministic local measurement covering collaboration, semantic merge, replay, review/playback/steering, UI, and VS Code.
- [ ] Update audit sets and version-aware counts without rewriting prior releases.
- [ ] Re-run all frontier gates and commit `release: add Forge Studio 2.27 evidence gates`.

### Task 12: Version, Full Verification, and Packaging

**Files:**
- Modify all version surfaces from `2.26.0` to `2.27.0`.
- Create release notes, verification report, weakness matrix, limitations, manifests, checksums, matrix, evidence bundle, and change-set.

- [ ] Run focused tests and all historical release gates.
- [ ] Run `npm test` and require every discovered file exactly once.
- [ ] Run the canonical Full Release Matrix; if execution time requires clustering, merge by canonical gate ID and receipt on the same clean commit.
- [ ] Build Windows, update payload, VSIX, optional NolaneNative pack, source reconstruction, and archive integrity.
- [ ] Verify the exact `/mnt/data` artifacts, checksums, source identity, audit totals, evidence logs, and clean Git tree.
- [ ] Commit `release: prepare Forge Studio 2.27.0` and preserve the branch/worktree when no remote target is supplied.
