# Nolane Agent Architecture

## System shape

```text
Electron desktop shell
├── single-instance lifecycle and secure BrowserWindow
├── narrow preload bridge
├── local runtime supervisor
├── update/recovery controllers
└── progressive UI: ui-v3 source → generated ui-dist
              │
              ▼
Nolane local runtime (`src/app.mjs` startup facade)
├── goals, missions, DAGs, checkpoints and automation
├── AgentLoop, providers, model routing and harnesses
├── governed files, process, browser, MCP, plugins and hooks
├── repository/context/memory intelligence
├── verification, reviewer, evidence and completion gates
├── layered Settings and Personalization projection
├── update signature verification and staging
└── loopback HTTP/API control plane
              │
              ▼
Durable local data
├── SQLite mission/event/evidence stores
├── settings user/project/local layers
├── project registry and worktrees
├── memory/context/model metadata
├── OS-vault credential references
└── update, migration and recovery records
```

## Composition root

`src/app.mjs` is the current startup and composition facade. It initializes storage, policy, providers, model intelligence, repository systems, agent execution, verification, UI services and HTTP transport. Checkpoint 14 extracts bounded factories behind that facade; it does not perform a big-bang rewrite or change startup contracts without characterization tests.

`src/server/routes.mjs` remains the compatibility route facade while bounded route registrars are extracted. The generated backend atlas must remain one-to-one with the effective route surface.

## Goal, mission and execution model

A goal is durable and may span multiple finite mission attempts. A mission plan becomes a dependency graph of tasks. Each task is prepared in a governed workspace or worktree and executed by `AgentLoop` with bounded turns, tool calls, tokens and elapsed time.

The model proposes typed actions. Policy, capability grants, workspace trust, command governance and resource budgets decide whether execution is allowed. Brokers return redacted results and receipts. A task is not complete merely because a model says so: verification, review, evidence and completion gates determine the accepted state.

## Model truth and management

The current source contains three related planes that Checkpoint 14 must converge rather than duplicate:

1. canonical profile/catalog logic in `src/model-profiles`;
2. provider compatibility projection in `src/providers/model-profile-registry.mjs`;
3. operational management, health and policy in `src/model-management`.

Canonical truth must distinguish base model, snapshot, provider deployment and local artifact. Pricing, limits, health and capability observations are scoped and time-sensitive. Unknown is never silently converted to false or zero.

## Settings and Personalization

`SettingsService` is authoritative and resolves:

```text
Defaults < User < Project < Local machine
```

Personalization is a versioned export/import and runtime-context projection over existing settings, with a small metadata ledger for source/history. It is not a second preference database. Personalization cannot grant capabilities, bypass approvals or weaken locked policy.

## Progressive experience

Everyday, Workspace, Studio and Expert are views over shared product state. Experience level changes presentation, not authority. The shell-level switcher must support direct any-to-any transitions and persist `experience.level` through the user Settings layer. Local storage is only a reconciled startup cache.

`ui-v3` is the editable source. `ui-dist` is the deterministic generated projection. `ui` remains recovery/compatibility-only until a parity ledger and retirement gate pass.

## Electron and updates

Electron keeps the renderer sandboxed with context isolation and narrow IPC. The renderer cannot choose installer paths, release URLs or commands.

The runtime update service verifies Nolane-signed metadata, repository identity, tag, commit, exact asset name, HTTPS redirects, byte count, SHA-256 and PE identity before staging. Release preparation generates `config/update.json` and the trusted public key. Checkpoint 14 adds background coordination, streaming download, session checkpointing, migration journals, explicit relaunch and post-update health/recovery.

An update is a binary/schema migration, not a new installation. Stable app identity and `userData` paths must preserve settings, projects, missions, drafts, memory, model metadata, trust records and OS-vault credential references. A real Windows CP13 → CP14 replay is a release gate.

## Compatibility substrate

The legacy external runtime is absent from production runtime and packaging paths; Nolane Native is the Nolane-owned production implementation. `vendor/forge-os` remains packaged and consumed through `ForgeOsBridge` as a compatibility/authority substrate. Its retirement requires replacement behavior, parity tests, receipts and packaging proof. See `docs/COMPATIBILITY-SUBSTRATES.md`.

## Resource strategy

The UI and advanced domains load lazily. Repository indexing is incremental. Resource governance bounds agents, terminals, browser sessions, model contexts, event queues and tool output. Production claims for 8 GB Windows systems require measured external receipts; schema or unit-test coverage is not sufficient.

## Evidence discipline

Every claim is classified as implemented and wired, implemented but not UI-wired, compatibility-only, mock/contract tested, externally certified, or planned. Source presence and route presence do not prove real provider, hardware or operating-system parity.
