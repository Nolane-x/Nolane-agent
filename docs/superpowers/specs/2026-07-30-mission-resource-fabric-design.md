# Forge Studio 2.19.0 — Mission Resource Fabric Design

## Goal

Make Forge Studio materially smoother on an 8 GB Windows-class machine while increasing agent capability through safe provider-session reuse, per-mission resource attribution, incremental intelligence, browser journey verification, controlled harness rollout, and a simpler Mission/Work/Evidence user shell.

## Non-negotiable constraints

- Core startup must not eagerly start providers, browsers, LSP servers, or optional hosted integrations.
- No component may persist raw prompts, model output, secrets, authorization headers, or unrestricted command lines in resource receipts.
- A one-shot CLI must never be described as a persistent multiplexed runtime.
- Session reuse must be invalidated by repository identity, branch/head, instruction revision, harness revision, tool-schema digest, or explicit mission reset.
- Lite and pressure states must prefer eviction and bounded concurrency over throughput.
- UI simplification must reduce navigation and render work; it must not add heavy animation, blur, or always-live graphs.
- Every closed weakness requires source behavior, direct tests, a mandatory release gate, raw measurement, and explicit non-claims.

## Architecture

### 1. Mission Process Ledger

`MissionProcessLedger` attributes a provider/browser/LSP process tree to project, mission, task, provider and session identifiers. It periodically samples the existing platform process-resource driver and records current/peak RSS, CPU time, process count, file-descriptor count where available, lifetime and exit reason. Receipts include only bounded metadata and hashes.

The ledger exposes mission and provider aggregates to the runtime snapshot. Missing platform capabilities remain explicit `unavailable`, never fabricated as zero.

### 2. Provider Session Host

`ProviderSessionHost` manages logical sessions behind protocol-aware adapters.

- Codex App Server supports a persistent process and reusable threads.
- Other providers remain one-shot unless their adapter explicitly implements `openSession`, `completeInSession` and `closeSession`.
- Sessions use repository and harness fingerprints and have bounded idle TTL, maximum uses and pressure-aware eviction.
- The host reports spawn, reuse, stale-invalidation and eviction receipts.

### 3. Shared Incremental Intelligence Journal

`IncrementalIntelligenceJournal` is a content-hash journal shared by lexical, semantic, structural, LSP/build/runtime and coverage consumers. It coalesces duplicate file changes, cancels superseded generations, records consumer cursors and provides bounded priority batches. Existing indexes may adopt it incrementally; 2.19 wires repository indexing and exposes contracts for future build/coverage consumers.

### 4. Harness Canary Controller

`HarnessCanaryController` assigns deterministic cohorts by project/mission hash. Candidate profiles receive only an allowed percentage, require minimum sample size, regression ceilings and replay evidence, and can be immediately disabled. It records profile and outcome metadata without raw prompts or outputs.

### 5. Browser Journey Evidence

`BrowserJourneyRecorder` wraps Playwright actions into a receipt containing URL origin, DOM digest, accessibility summary, console/network failure summaries, screenshot/video artifact hashes and assertion outcomes. Binary artifacts stay project-contained. The recorder supports repair/replay comparison but does not claim visual correctness from a screenshot alone.

### 6. Hosted Lifecycle State Machine

`HostedLifecycleCoordinator` models Issue → branch/worktree → local verification → pull request → CI observation → bounded repair → human merge gate through least-privilege provider adapters. Without credentials it remains locally testable and returns explicit external-gate states rather than pretending remote work occurred.

### 7. Mission / Work / Evidence UI shell

The icon rail is reduced to three primary destinations:

- **Mission:** objective, plan, progress and completion controls.
- **Work:** editor, terminal, browser, agents and repository intelligence.
- **Evidence:** diff, tests, traces, receipts, cost and resource use.

Advanced centers remain accessible through Ctrl+K and contextual drawers. A compact resource HUD displays agent/provider state and pressure. Long lists use `content-visibility` and bounded rendering. Motion remains subtle and is disabled by the existing runtime performance policy.

## Data flow

1. A mission asks the provider registry for completion.
2. Admission occurs through the runtime lease pool.
3. The session host resolves or creates a protocol-supported session fingerprint.
4. The process ledger registers the root PID and samples the process tree.
5. The adaptive harness composer creates the provider-specific request and canary controller chooses stable/candidate profile.
6. Completion outcome updates quality, resource and canary metrics.
7. Repository changes enter the shared journal; consumers process only the newest generation.
8. Browser verification emits journey receipts into Evidence.
9. Runtime and mission APIs project resource, session, journal, canary and journey summaries to the UI.

## Failure handling

- Process disappears: finalize the ledger entry with `process-unavailable` and preserve the last valid sample.
- Host pressure: stop admitting new sessions, evict idle sessions, then close nonessential active sessions only in emergency.
- Stale fingerprint: close or abandon the old logical session and create a fresh one.
- Journal consumer failure: retain cursor, back off, and retry the same bounded batch; do not advance acknowledgment.
- Canary regression: disable candidate immediately and emit rollback recommendation.
- Journey artifact failure: preserve assertion/network/console evidence and mark visual artifacts unavailable.
- Hosted provider unavailable: stop at an explicit external gate; never report PR/CI success.

## Acceptance evidence

The 2.19 release gate must demonstrate:

- per-mission CPU/RSS/process attribution and peak tracking;
- provider process/session reuse only for a capable adapter;
- stale session invalidation and pressure eviction;
- reduced repeated provider startup in a synthetic measurement;
- deduplicated journal batches with monotonic consumer cursors;
- deterministic canary assignment and automatic regression cutoff;
- browser journey receipts with DOM/a11y/network/console and artifact hashes;
- hosted lifecycle external-gate honesty;
- primary UI navigation reduced to Mission/Work/Evidence while all advanced centers remain reachable;
- full existing release matrix remains green and the Node runner terminates cleanly.
