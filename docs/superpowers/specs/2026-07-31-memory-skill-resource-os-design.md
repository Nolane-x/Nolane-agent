# Forge Studio 2.26.0 Memory, Skill, Replay & Resource Admission Design

## Goal

Build a governed Memory Operating System and Resource Admission Plane that lets Forge Studio retain useful causal knowledge, replay high-value episodes, compile transferable skills, prevent negative transfer, and admit expensive resources only when their expected verified value justifies RAM/time cost.

## Scope

This release targets frontier requirements 39.1–39.18 and 40.1–40.18 where local deterministic evidence is possible. It reuses `MemoryService`, `ProjectMemorySidecar`, `EpisodicBinder`, `MissionResourceFabric`, `ResourceGovernor`, provider/LSP pools, process-tree accounting, history archives, and existing canonical receipts.

Production learned memory policies, long-term skill survival across weeks, broad cross-repository transfer benchmarks, direct kernel-level resource enforcement on every OS, and production neural embedding unload measurements remain partial or external gates when the release runner cannot prove them.

## Architectural choice

Use one lazy `MemorySkillResourcePlane` owned by `DecisionPlane` and projected through `MissionResourceFabric`. Focused components live under `src/memory/`, `src/skills/`, `src/runtime/`, and `src/storage/`. Existing services remain the source of truth; the new plane coordinates governance, versioning, replay, skill promotion, and resource admission rather than creating another mission engine or database.

## Components

### 1. Memory Operating System

`MemoryOperatingSystem` adds governed lifecycle operations over project memory:

- `suppress`: hide memory from a task/context without changing global validity.
- `deprioritize`: lower retrieval priority with a reason and expiry.
- `invalidate`: mark a version no longer valid from a repository/branch point.
- `archive`: move a version out of hot retrieval while preserving provenance.
- `abstract`: create a new schema version from verified episodes while preserving source links.
- `delete`: privacy/corruption deletion requiring explicit actor and receipt.

Every edit creates an immutable version row with `validFrom`, `validUntil`, parent version, operation, source hash, actor, and public receipt. Existing memory rows remain compatible; the operating system stores version metadata lazily in dedicated SQLite tables.

Memory is separated into four layers:

- subconscious buffer: bounded, short-lived observations;
- episodic memory: causal episodes and outcomes;
- semantic schema: verified abstractions;
- exception store: legacy/platform exceptions that override schemas.

The retrieval projection always checks current validity, branch/source freshness, suppression, priority, and exception conflicts.

### 2. Governed memory policy and consolidation

`MemoryPolicyController` evaluates `ADD`, `UPDATE`, `DELETE`, `RETRIEVE`, `SUMMARIZE`, and `NOOP` proposals. A proposal requires public evidence and cannot write hidden reasoning. Consolidation is permitted only when at least one governed trigger is strong enough: recurrence, surprise/prediction error, verified value, unresolved commitment, or explicit user action.

A policy candidate cannot change production behavior in 2.26.0. It produces shadow decisions and promotion evidence for later releases.

### 3. Scheduled Replay and model-time

`ReplayScheduler` scores causal episodes using:

- prediction error;
- executor/reviewer conflict;
- later revert or regression;
- transfer potential;
- pending commitment;
- calibration error;
- age and prior replay saturation.

Replay cadence is based on model-time, not raw step count. `ModelTimeClock` advances from policy drift, schema changes, correction rate, skill revisions, and task-distribution shift. Replay emits a bounded queue and does not directly call a model.

### 4. Compositional Skill Compiler

`CompositionalSkillCompiler` converts a verified workflow into a typed operator containing:

- preconditions and parameters;
- effects and invariants;
- verifier and decomposition;
- failure signatures;
- token/time/RAM cost estimate;
- rollback contract;
- source episode receipts;
- parent/fork/merge lineage.

Skills can be recombined only when parameter types, preconditions, effects, and invariants are compatible. Promotion requires transfer evidence on a different repository or vocabulary fixture and a successful `StabilityPlasticityGuard` decision.

### 5. Stability–Plasticity Guard

`StabilityPlasticityGuard` compares a candidate memory/skill policy against baseline behavior using:

- forward transfer;
- backward transfer;
- negative transfer;
- late-task learning;
- memory growth;
- correction rate;
- verified criteria retention.

The guard blocks promotion if old skills regress, exceptions are lost, memory grows beyond budget, or the candidate only succeeds on the task that created it. Exact rollback targets and policy lineage are mandatory.

### 6. Resource leases and admission

`ResourceAdmissionController` creates leases for model, browser, terminal, LSP, embedding worker, indexer, test runner, and provider host resources. Each lease records mission/task/owner, process root when available, RSS/CPU/FD/process budget, expected utility, time cost, idle TTL, reversibility, and admission receipt.

Admission score is based on expected verified utility divided by incremental MB-time cost, with hard denial when the system would leave its viability region. Existing provider and LSP pools remain authoritative for actual process reuse.

### 7. Viability prediction and Device Doctor

`ViabilityRegionController` defines bounds for available RAM, disk, error rate, active agents, pending irreversible actions, unverified memory, and policy drift. It predicts near-term pressure from recent samples and planned demand, allowing the system to unload embedding/session/browser resources before brownout.

`LocalDeviceDoctor` uses real local measurements to recommend Lite, Balanced, or Performance mode with an explanation. It does not benchmark model quality or modify settings without explicit user action.

### 8. Content-addressed artifact and bounded output

`ContentAddressedArtifactStore` persists raw tool output and logs by SHA-256. RAM retains only summary, byte length, cursor/offset, and bounded preview. Tool output is truncated before entering context or memory; the complete raw artifact remains retrievable by authorized code through its hash.

This component avoids copying the same payload into multiple subsystem tables and provides a common receipt for evidence, replay, and verification.

### 9. Idle lifecycle and orphan cleanup

`ResourceLifecycleCoordinator` applies idle TTL and governor pressure to registered resources. It delegates provider/LSP/browser shutdown to their owning adapters, detects finalized mission resources whose process trees remain alive, and requests process-tree termination through the existing platform resource driver.

No process is killed without an owned lease, mission stop receipt, and matching process identity evidence.

### 10. Lazy integration

`MemorySkillResourcePlane` owns the components above and is lazy behind `DecisionPlane`. `MissionResourceFabric.publicView()` exposes only bounded snapshots and receipts. `ContextMemoryCenterService` gains user-facing memory operations without exposing hidden reasoning. Simple low-risk tasks do not load replay, skill, or admission services.

## Data flow

1. A causal episode or user memory action enters the Memory OS.
2. The policy controller decides `ADD/UPDATE/DELETE/RETRIEVE/SUMMARIZE/NOOP` in shadow/governed mode.
3. A versioned memory operation is committed with validity interval and receipt.
4. Replay Scheduler prioritizes episodes using model-time and objective outcome signals.
5. Verified recurrent workflows are proposed to the Skill Compiler.
6. Transfer fixtures and Stability–Plasticity Guard decide whether a skill remains draft, is rejected, or may be promoted.
7. Before expensive replay/embedding/browser/test work, Resource Admission evaluates utility per MB-time against the viability region.
8. Raw outputs are written once to the content-addressed store; context and memory receive bounded projections.
9. Idle or stopped resources are unloaded or terminated through their owning adapters.

## Privacy and safety

- No chain-of-thought, raw prompt, raw model output, secret, environment dump, authorization header, or hidden rationale is stored.
- Memory deletion is explicit and auditable; privacy deletion may remove content while preserving a tombstone receipt.
- Memory/skill policy candidates remain shadow-only until explicit promotion evidence exists.
- Skill promotion cannot grant new capabilities, disable verification, expand filesystem/network scope, or alter acceptance criteria.
- Resource termination requires owned lease and process identity evidence.

## Performance constraints

- All new stores and services are lazy.
- `src/app.mjs` remains at or below 160 static imports and 180 constructor expressions.
- Hot snapshots are bounded; raw logs live on disk.
- Replay queues, memory versions, skills, and resource journals have explicit caps.
- Lite mode must not load a skill compiler or replay scheduler for ordinary single-step work.

## Testing strategy

Every component is developed RED→GREEN. Integration tests use a real temporary SQLite store, real filesystem artifacts, spawned child process trees where platform-safe, and deterministic transfer/replay fixtures. Release measurements distinguish core behavior, adapter-tested behavior, and external production claims.

## Release evidence and non-claims

The 2.26 release gate must prove versioned memory operations, layered retrieval, governed consolidation, replay/model-time scoring, typed skill compilation, transfer/stability blocking, resource utility admission, viability prediction, bounded artifact storage, idle cleanup, privacy, and lazy loading. It must state that long-term real-world skill survival, production learned memory policies, broad cross-repository transfer, and direct resource enforcement on every target OS remain unproven.
