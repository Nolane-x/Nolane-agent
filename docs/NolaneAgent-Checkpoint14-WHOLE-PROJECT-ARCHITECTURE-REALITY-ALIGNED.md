# Nolane Agent — Whole-Project Architecture (Reality-Aligned Revision)

**Target milestone:** Checkpoint 14 — Trust, Adoption & Autonomy  
**Document type:** Product and system architecture  
**Verified baseline:** Checkpoint 13 — Progressive Experience  
**Baseline source commit:** `72f35b57aa32299bb4369eb84759c489b03ce697`  
**Status:** Implementation-ready architecture; this document does not claim the described Checkpoint 14 work is already implemented  
**Revision date:** 2026-08-03

---

## 1. Purpose

Checkpoint 14 must make Nolane Agent easier to adopt, more transparent, safer to update, and more accurate about its own model capabilities without weakening the agent runtime already present in Checkpoint 13.

The milestone must satisfy all of the following:

1. A first-time user can enter Nolane through a short personalization flow or recommended defaults without understanding providers, runtimes, worktrees, receipts, or orchestration internals.
2. A user can move directly between **Everyday, Workspace, Studio, and Expert** at any time, including direct **simple ↔ advanced** transitions.
3. Experience switching preserves the current conversation, mission, project, draft, attachments, route context, and running agent state.
4. Personalization changes presentation and collaboration behavior but never silently increases filesystem, shell, browser, network, or autonomy authority.
5. Model routing uses one canonical model-truth plane with explicit uncertainty, scoped provenance, freshness, health, and evaluation receipts.
6. Every significant observable action taken by an agent is presented at the appropriate level of detail without exposing private hidden chain-of-thought.
7. GitHub releases produce a trusted Windows installer and signed Nolane update feed; installed clients notify, download, verify, install, relaunch, restore state, and recover safely.
8. Updating Nolane never repeats onboarding and never silently resets settings, missions, projects, memory, credentials, or UI state.
9. Checkpoint 14 corrects the source-level identity and architecture drift discovered in Checkpoint 13 rather than extending those inconsistencies.
10. Existing backend, compatibility, recovery, and expert capabilities remain available until a receipt-backed retirement gate proves they can be removed.

---

## 2. Verified Current Baseline

This section distinguishes verified source behavior from planning targets.

### 2.1 Release identity and measured surface

The verified Checkpoint 13 source has:

| Property | Verified value |
|---|---|
| Product version | `5.0.0-beta.6` |
| Source commit | `72f35b57aa32299bb4369eb84759c489b03ce697` |
| Electron entry | `desktop/main.cjs` |
| Electron version | `43.2.0` |
| Windows target | NSIS x64 |
| Executable | `NolaneAgent.exe` |
| Installer pattern | `NolaneAgent-Setup-${version}-${arch}.exe` |
| App ID | `com.nolane.agent` |
| Stable NSIS GUID | `d4f38ef8-b26d-4fc8-9b83-31a988f96251` |
| Settings categories | 18 |
| Settings fields | 84 |
| Progressive experience levels | 4 |
| Global destinations | 8 |
| Control Plane domains | 14 |
| Backend route/pattern inventory | 398 |
| Backend domains | 98 |
| Exact built-in model profiles | 567 |
| Model family/size templates | 75 |

Counts are retention baselines, not proof that every route, model, or UI surface has been certified against a real external provider or Windows environment.

### 2.2 Runtime composition

`src/app.mjs` is the current composition root. It is approximately 1,311 lines and constructs the local runtime, including:

- `StudioStore` and durable event storage.
- Goals, missions, task DAGs, runs, checkpoints, and automation.
- Provider registry, CLI/provider adapters, model discovery, model profile registries, health/policy management, and routing.
- Repository intelligence, Git/worktree governance, AST/symbol/search services, and test/verification services.
- Governed tools, command execution, browser, MCP, plugins, hooks, credentials, workspace trust, approvals, and capability grants.
- Sovereign Agent Kernel, Nolane-native services, ForgeOS bridge, optional modules, resource governance, UI summary, and HTTP server.

`src/server/routes.mjs` is the current HTTP control-plane router. It is approximately 1,990 lines and accepts a very broad dependency set. It exposes the 398-route/pattern inventory used by the progressive UI and compatibility surfaces.

These files are operational, but their size and dependency breadth are architectural debt. Checkpoint 14 must modularize them without changing route identity or runtime behavior.

### 2.3 Durable data plane

The current durable state is not one single store:

- `src/storage/studio-store.mjs` uses SQLite for projects, providers, missions, tasks, runs, checkpoints, interrupts, evidence, messages, goals, plan revisions, schedules, events, and related records.
- Additional SQLite or file-backed stores exist for model outcomes, semantic indexes, plugin transparency, capability grants, workspace trust, memory systems, enterprise modules, sessions, and other bounded domains.
- `SettingsService` stores layered JSON settings:

```text
Defaults < User < Project < Local machine
```

Current settings paths are:

```text
<dataDir>/settings/user.json
<project>/.forge/settings.json
<dataDir>/settings/projects/<projectId>.local.json
```

Settings writes are already atomic and reject secret-looking keys. Credentials remain in the credential vault rather than settings JSON.

Checkpoint 14 must extend these stores rather than create parallel, conflicting sources of truth.

### 2.4 Progressive UI source, build, and fallback

The real UI arrangement is:

```text
ui-v3/   → editable source for the progressive experience
ui-dist/ → generated, receipt-checked production UI served by the runtime
ui/      → historical compatibility/recovery UI and fallback surface
```

`src/ui/ui-root-resolver.mjs` selects `ui-dist` for UI v3 when its build and source-release receipts are valid. In production, an invalid or missing UI v3 receipt fails closed. In development, the resolver may fall back to `ui`.

Therefore:

- Checkpoint 14 UI work must be implemented in `ui-v3` and then rebuilt into `ui-dist`.
- `ui-dist` must not be treated as the hand-edited source.
- `ui` cannot yet be deleted because it still contains compatibility and update/recovery behavior not fully represented in the new progressive UI.
- “UI v3 exists” does not by itself prove forensic parity with the legacy/recovery UI.

### 2.5 Current experience switching behavior

Checkpoint 13 already defines:

```text
Everyday → Workspace → Studio → Expert
```

The top bar contains an experience pill. However, the present implementation:

- Cycles to the next level rather than opening a direct destination menu.
- Primarily persists the selection in `localStorage` through `nolane.ui.preferences.v2`.
- Does not reliably save a shell-level switch through `SettingsService` unless the user is inside Settings and saves.
- Does not yet capture a complete transition state for drafts, attachments, active subviews, open files, or route mapping.

Checkpoint 14 replaces this with a direct, persistent, bidirectional Experience Switcher backed by the user settings layer and a bounded view-state bridge.

### 2.6 Current personalization baseline

The Settings catalog already contains, among other fields:

- `experience.level`
- `general.language`
- `general.defaultIntent`
- `personalization.explanationDepth`
- `personalization.responseStyle`
- `personalization.askBeforeAmbiguousChanges`
- `personalization.showReasoningSummary`
- `personalization.preferredDocumentationLanguage`
- appearance, accessibility, memory, notifications, privacy/data, permission, autonomy, update, and model-routing preferences

The new UI can load and save layered settings, preview several appearance preferences, and export effective settings. However:

- There is no first-run onboarding controller.
- There is no onboarding completion record independent of app version.
- Preference provenance currently identifies the winning **layer**, not whether a value came from onboarding, an explicit edit, an accepted recommendation, or policy.
- The core agent/planner/provider path does not yet consume the personalization fields as a bounded user-preference context.
- The current experience pill and local cache can drift from effective user settings.

Personalization in Checkpoint 14 is therefore a **versioned projection and metadata contract over the existing Settings system**, not a second preference database.

### 2.7 Current model-intelligence baseline

Model intelligence is already implemented in three cooperating layers:

1. **Canonical/advanced truth registry** — `src/model-profiles/*`  
   Defines the exact profile skeleton, family/size templates, inference, discovery merge, export receipts, and conservative unknown semantics.

2. **Operational compatibility registry** — `src/providers/model-profile-registry.mjs`  
   Presents provider-oriented records to existing provider/UI code and adapts discoveries and probes into the advanced registry.

3. **Model management plane** — `src/model-management/*`  
   Provides health summaries, policy evaluation, recommendation, portfolio selection, dossiers, receipts, and snapshots.

Existing HTTP endpoints include:

- `GET /api/model-profiles`
- `POST /api/model-profiles/discover`
- `POST /api/model-profiles/probe`
- `GET /api/model-management/snapshot`
- `POST /api/model-management/recommend`
- `POST /api/model-management/portfolio`
- `POST /api/model-management/observations`
- `GET /api/model-management/dossier`

The progressive Settings UI already exposes model discovery and capability probes. What remains incomplete is not “creating Model Profiles from zero”; it is converging these layers around one durable truth plane, adding field-level evidence/freshness, wiring execution observations, and exposing the existing dossier/recommendation capabilities through a complete UI.

A naming constraint must be respected: the compatibility API already emits `nolane.model-profiles.v2`, while the advanced exact profile schema uses `schemaVersion: 1.0.0`. Checkpoint 14 must avoid introducing another ambiguous “v2” label without a migration and compatibility decision.

### 2.8 Current updater and packaging baseline

Electron and the signed updater already exist:

- `desktop/main.cjs`
- `desktop/preload.cjs`
- `desktop/runtime-supervisor.cjs`
- `desktop/update-controller.cjs`
- `src/update/update-service.mjs`
- `electron-builder.config.cjs`
- `build/installer.nsh`
- `.github/workflows/release.yml`
- `scripts/prepare-update-trust.mjs`
- `config/update.example.json`

Important source truth:

- The source archive contains `config/update.example.json`.
- `config/update.json` and `config/nolane-agent-update-public.pem` are generated during the trusted release workflow from the signing configuration. They are not stable source-controlled baseline files.

The current trust chain verifies:

- Ed25519-signed Nolane manifest.
- Repository, channel, release tag, release commit, exact asset name, and HTTPS/redirect policy.
- Byte count, SHA-256, PE header, launcher minimum, and path confinement.
- A narrow Electron IPC surface that does not accept an arbitrary installer path, URL, or command from the renderer.

The current gaps are:

- No desktop background update coordinator.
- No automatic scheduled checks or real use of `updates.autoDownload`.
- Staging buffers the full installer in memory before writing it.
- No unified UI v3 update store and notification surface.
- The Electron controller verifies and launches the installer, then quits, but explicit post-install relaunch behavior is not implemented in `build/installer.nsh`.
- `markHealthy()` proves only a bounded current-version recovery record after the main URL loads; complete migrations, session restoration, and last-known-good binary recovery are not yet certified.
- No real Windows CP13 → CP14 update replay has yet proven the entire lifecycle.

### 2.9 Compatibility substrates and documentation drift

The Checkpoint 13 source contains two important historical truths:

- `README.md` still identifies the release as “Native Runtime Conversion Wave 6”.
- `docs/ARCHITECTURE.md` still identifies “Forge Studio 2.16.0”.

In addition:

- `vendor/forge-os` is packaged by Electron and used through `ForgeOsBridge`; it is a production compatibility/authority substrate, not merely dead historical source.
- NolaneNative runtime and archive are excluded from production packaging and routes, while historical attribution remains in notices and evidence.

Checkpoint 14 must correct product identity and architecture documentation without making a false “fully native” claim. ForgeOS-backed behavior may be migrated incrementally, but the substrate remains supported until capability-by-capability replacement and retention receipts pass.

---

## 3. Architectural Principles

### 3.1 Progressive disclosure, not separate products

Everyday, Workspace, Studio, and Expert are projections over the same backend, mission state, permissions, evidence, and user data.

### 3.2 UI level never changes authority

Changing experience level exposes more or less information. It never grants new filesystem, shell, browser, network, plugin, MCP, model, or autonomy permissions.

### 3.3 Existing stores remain authoritative

- Mission/project/runtime facts remain in the existing durable domain stores.
- Settings values remain in `SettingsService` layers.
- Personalization metadata augments Settings; it does not replace Settings.
- Model truth is normalized through the advanced registry; compatibility records are projections, not a second independent truth source.

### 3.4 Unknown is not false

For model capabilities, pricing, limits, lifecycle, and policy, unknown values remain unknown until supported by scoped evidence.

### 3.5 No fake capability

Every interactive control must be:

- Connected to a functioning backend action.
- Read-only and explicitly labelled.
- Disabled with an exact reason.
- Hidden until its adapter exists.

### 3.6 Updates are migrations, not reinstalls

An update changes application binaries and possibly schema versions. It does not create a new user identity, repeat onboarding, or reset local state.

### 3.7 Evidence before claims

A route, test double, generated artifact, or successful installer build is not enough to claim provider, Windows, accessibility, or recovery parity. Claims require the corresponding receipts.

### 3.8 Compatibility retirement is gated

Legacy UI, aliases, ForgeOS-backed behavior, and old schemas remain until:

1. A replacement is production-wired.
2. Retention and parity tests pass.
3. Migration and rollback are proven.
4. A removal receipt is recorded.

---

## 4. Whole-System Context

```text
GitHub repository and release pipeline
├── Source, tags, CI and full release matrix
├── Windows runner
├── NSIS installer and blockmap
├── Generated update.json and public key
├── Signed Nolane update manifest
├── GitHub Release assets
└── Per-channel update feed
              │
              ▼
Electron Desktop Shell
├── Single-instance lifecycle
├── Secure BrowserWindow and preload
├── Runtime supervisor
├── Desktop update coordinator (CP14)
├── Window/session persistence (CP14)
├── Notification bridge
└── Post-update health and recovery
              │
              ▼
Nolane Local Runtime
├── Bootstrap/composition modules
├── HTTP/API control plane
├── Sovereign Agent Kernel
├── Goal/mission/task orchestration
├── Provider and model management
├── Repository intelligence
├── Tools, browser, MCP, plugins and hooks
├── Verification, review and evidence
├── Signed update verification/staging
├── ForgeOS compatibility/authority bridge
└── Durable event stream
              │
              ▼
Durable Local Data Plane
├── StudioStore and domain SQLite stores
├── Layered SettingsService
├── Personalization provenance/history sidecar
├── Onboarding state
├── Session/window/draft state
├── Model observation/evaluation ledgers
├── Credentials in OS vault
├── Artifact/content-addressed storage
├── Update staging and recovery
├── Migration journal
└── Last-known-good snapshots
              │
              ▼
Progressive UI pipeline
├── ui-v3 source
├── ui-dist receipt-checked production build
├── Everyday
├── Workspace
├── Studio
├── Expert
└── ui legacy/recovery compatibility fallback
```

---

## 5. Runtime Composition and Route Modularization

### 5.1 Objective

Reduce dependency concentration without rewriting the working runtime.

### 5.2 Composition target

`src/app.mjs` remains the public startup entry but delegates bounded assembly to domain factories, for example:

```text
src/bootstrap/create-storage-runtime.mjs
src/bootstrap/create-security-runtime.mjs
src/bootstrap/create-provider-model-runtime.mjs
src/bootstrap/create-repository-runtime.mjs
src/bootstrap/create-agent-runtime.mjs
src/bootstrap/create-experience-runtime.mjs
src/bootstrap/create-update-runtime.mjs
```

Each factory:

- Accepts a narrow dependency object.
- Returns a frozen, named domain runtime.
- Exposes `close()` or lifecycle hooks where required.
- Has direct integration tests.
- Does not change product behavior during extraction.

### 5.3 Route target

`src/server/routes.mjs` remains a compatibility facade while domain registrars move under `src/server/routes/`, for example:

```text
src/server/routes/model-routes.mjs
src/server/routes/settings-routes.mjs
src/server/routes/update-routes.mjs
src/server/routes/mission-routes.mjs
src/server/routes/workroom-routes.mjs
src/server/routes/control-plane-routes.mjs
```

The route retention contract must prove:

- All 398 route/pattern identities remain represented unless an explicit migration record exists.
- Existing response schemas remain compatible.
- Authentication, authorization, body limits, and security telemetry remain applied.
- The generated backend atlas remains deterministic.

### 5.4 Non-goal

Checkpoint 14 does not replace the entire service graph with a new framework or dependency-injection container. It performs receipt-backed extraction and convergence only.

---

## 6. Progressive Experience Architecture

### 6.1 Experience levels

#### Everyday

For chat, writing, learning, summarization, simple planning, and low-complexity tasks.

Visible by default:

- Conversations and composer.
- Attachments and context controls.
- Recent projects and work.
- Concise Execution Story.
- Settings.
- A permanent direct action to open Workspace, Studio, or Expert.

#### Workspace

Adds:

- Missions, plans, milestones, and activity.
- Approvals and review queue.
- Project view and output artifacts.
- Human handoff points.

#### Studio

Adds:

- File tree, editor, terminal, diff, tests, verification, repository search, and worktree context.

#### Expert

Adds:

- Full Control Plane.
- Model Intelligence and routing evidence.
- Context/memory inspection.
- Runtime/resource control.
- Security, governance, release, evidence, and recovery surfaces.

### 6.2 Permanent direct switcher

A shared Experience Switcher is mounted at the application shell level and available through:

1. Persistent title bar/header.
2. Application menu.
3. Command Palette.
4. Settings.
5. Keyboard shortcut.

It presents all four destinations directly. The current cyclic-only behavior is removed.

### 6.3 Persistence contract

- A switch writes `experience.level` to the user Settings layer.
- The UI cache is a startup/performance cache only and is reconciled against effective settings.
- A failed settings write does not silently show the new level as permanently saved.
- Project and local layers cannot silently override the user-only `experience.level` field.

### 6.4 Transition state

Before switching, capture a bounded transition record:

- Current route and route parameters.
- Conversation/thread ID.
- Mission ID.
- Project ID.
- Composer draft and attachment references.
- Open file/artifact and selected tab.
- Scroll/focus anchor where practical.
- Summary dock state.

After switching:

- Restore shared state.
- Map an inaccessible child route to the nearest representable parent.
- Keep missions, terminals, and background work running.
- Display a reversible notice when detail is hidden.
- Never change permissions or autonomy.

---

## 7. First-Run Onboarding and Personalization Architecture

### 7.1 Onboarding is not provider setup

The onboarding flow does not ask cloud versus local model and does not require a provider connection.

### 7.2 Onboarding state

Onboarding completion is stored separately from app version:

```json
{
  "schema": "nolane.onboarding.v1",
  "completed": true,
  "completedAt": "ISO-8601",
  "schemaVersion": 1,
  "source": "guided|recommended-defaults|skipped",
  "lastReviewedAt": "ISO-8601"
}
```

First-run detection order:

1. Valid completion record → skip.
2. Existing mature user data/settings/projects/missions → treat as upgrade and skip.
3. Managed policy disables onboarding → skip.
4. Otherwise show onboarding.

### 7.3 Personalization is a Settings projection

Canonical personalization export may use a versioned document, but values remain mapped to existing Settings keys. A profile service is responsible for:

- Validated mapping to Settings.
- Source/provenance metadata.
- History and accepted recommendations.
- Export/import preview.
- Runtime-safe personalization context.

It does not create an independent competing value store.

### 7.4 Existing enum compatibility

Checkpoint 14 begins with current canonical values:

```text
experience.level: everyday | workspace | studio | expert
personalization.explanationDepth: concise | balanced | detailed | research
personalization.responseStyle: direct | collaborative | teacher | reviewer
appearance.theme: system | nocturne | obsidian | graphite | aurora | snow | paper
appearance.accent: violet | blue | cyan | rose | amber | emerald
appearance.density: comfortable | compact
appearance.motion: system | full | reduced
```

New values require an explicit catalog migration and UI/runtime support; documentation must not invent values that the validator rejects.

### 7.5 Runtime consumption

A bounded Personalization Context is compiled from safe preferences and passed to:

- Planner presentation.
- Agent response formatting.
- Clarification policy inside already-approved scope.
- Documentation language.
- Execution Story detail.
- Notification behavior.

The compiler excludes or treats as hard policy boundaries:

- Permission grants.
- Sandbox requirements.
- Credential access.
- Browser/network authorization.
- Autonomous risk limits.

Security and project policy always override preference.

---

## 8. Model Truth Plane Architecture

### 8.1 One canonical truth, multiple projections

The target is:

```text
Official docs/API discovery/evaluations/observations
                  │
                  ▼
Canonical Model Truth Registry
├── base model identity and lineage
├── snapshot/version
├── deployment variant
├── local artifact variant
├── field-level provenance and freshness
├── conflict records
└── deterministic receipts
                  │
       ┌──────────┼───────────┐
       ▼          ▼           ▼
Compatibility  Model       UI/API
projection     management  dossiers/comparison
```

`src/model-profiles` becomes the authoritative truth plane. `src/providers/model-profile-registry.mjs` remains a compatibility projection during migration. `src/model-management` remains the policy, health, recommendation, and dossier plane.

### 8.2 Data entities

The canonical model truth distinguishes:

- Base Model.
- Model Snapshot/Version.
- Deployment Variant.
- Local Artifact Variant.

Cloud deployment and GGUF/quantized local artifacts never share deployment-specific limits, economics, latency, or hardware measurements.

### 8.3 Durable ledgers

Add durable, append-oriented records for:

- Provider discovery.
- Field observations and conflicts.
- Evaluation receipts.
- Health windows and circuit-breaker state where persistence is appropriate.
- Pricing/lifecycle history.

The current in-memory `ModelHealthLedger` remains useful but is not by itself durable product history.

### 8.4 Runtime feedback

Provider execution outcomes must feed the model-management observation path automatically, with redaction and bounded metadata. A manual HTTP observation endpoint alone is insufficient.

### 8.5 UI

The progressive UI uses existing management endpoints and adds:

- Catalog filters.
- Dossier view.
- 2–5 model comparison.
- Verified/inferred/stale/unknown/conflicted badges.
- Routing explanation showing selected model, rejected candidates, blockers, estimated cost/latency, fallback chain, and receipts.

---

## 9. Startup, Session, Draft, and Window Restoration

### 9.1 Normal launch

```text
Electron starts
→ obtains single-instance lock
→ resolves stable userData
→ restores safe window bounds
→ starts local runtime
→ runs non-destructive migrations
→ reconciles cached UI preferences with SettingsService
→ decides onboarding vs existing-user resume
→ restores route/session/draft
→ resumes durable mission checkpoints
→ marks runtime/UI healthy
→ starts delayed update coordinator
```

### 9.2 Restored state

Preserve:

- Effective user settings and personalization metadata.
- Selected experience level.
- Window bounds/maximized state.
- Last route.
- Conversation, mission, and project identity.
- Composer draft and attachment references.
- Open file/artifact.
- Pending approval references.
- Update channel, deferrals, and ignored version.

Destructive commands are never automatically replayed after restart. Running work resumes only from a durable kernel/mission checkpoint.

---

## 10. GitHub-to-Desktop Update Architecture

### 10.1 Release pipeline retained

The existing Windows release workflow remains authoritative for:

- Full release validation.
- Trusted update configuration generation.
- NSIS installer build.
- Signed Nolane manifest creation.
- SHA-256 and attestation.
- GitHub Release publication.
- Signed channel feed update.

### 10.2 Desktop update coordinator

A new coordinator starts only after runtime and main UI health. It:

- Reads effective update settings.
- Performs delayed startup checks and periodic checks with jitter.
- Calls the trusted runtime check/stage APIs.
- Auto-downloads only when enabled.
- Publishes bounded progress/state to the renderer.
- Persists deferred/ignored versions.
- Detects active mission conflicts.
- Requests checkpoint/quiesce before install.
- Never accepts renderer-selected URLs, paths, or commands.

### 10.3 Streaming staging

Refactor staging from whole-file buffering to streamed writes under `<userData>/updates`:

1. Validate signed manifest and release identity.
2. Stream into a confined temporary file.
3. Enforce byte limit while streaming.
4. Incrementally hash.
5. Emit progress.
6. Flush/sync and verify exact size, hash, PE header, and name.
7. Atomically rename.
8. Write pending marker only after verification.

### 10.4 Install and relaunch

The pre-install sequence:

- Flush settings and personalization metadata.
- Persist route/session/draft/window state.
- Checkpoint active missions.
- Create pre-update snapshot and recovery record.
- Reverify staged installer.
- Enter quiescing state.
- Launch NSIS.
- Quit only after installer process starts successfully.

The installer contract must explicitly relaunch the newly installed application with a fixed safe `--post-update` flag or equivalent non-user-controlled handshake.

### 10.5 Post-update health

The target version is healthy only after:

- Electron window creation.
- Runtime startup.
- Stable userData identity confirmation.
- Settings and personalization load.
- Mission/project stores open.
- Required migrations complete.
- Main UI renders.
- Previous session state restores or reports an exact recoverable reason.

Only then remove the pending marker and advance last-known-good state.

---

## 11. No-Data-Loss, Migration, and Recovery Architecture

### 11.1 Durable-store registry

Checkpoint 14 creates a machine-readable inventory of durable stores, schema owners, backup policy, migration version, and credential-exclusion rules.

### 11.2 Migration journal

Every data-changing release records:

```json
{
  "schema": "nolane.migration-journal.v1",
  "fromVersion": "5.x",
  "toVersion": "5.y",
  "startedAt": "ISO-8601",
  "steps": [
    { "id": "example-step", "state": "completed", "receiptSha256": "..." }
  ],
  "state": "running|completed|failed|recovery-required"
}
```

Each migration is idempotent, validated before/after, and uses atomic replacement or a database transaction appropriate to the store.

### 11.3 Snapshot policy

- Snapshot small critical metadata before every update.
- Reference large content-addressed artifacts instead of blindly duplicating them.
- Exclude credentials, secrets, disposable caches, and provider tokens.
- Retain at least one last-known-good state within a disk budget.

### 11.4 Recovery

Recovery separates binary rollback from data rollback:

- Prefer rolling back the application binary while preserving forward-compatible user data.
- Restore user data only when a migration is incomplete or corrupt.
- Never overwrite newer user work automatically.
- Present exact failed step, diagnostics export, retry, last-known-good launch, and selective metadata restore.
- Never default to “reset everything”.

---

## 12. Unified Execution Story Architecture

The project already has durable events, mission timelines, tool receipts, evidence, UI summary, process tracking, and kernel state. Checkpoint 14 creates a projection layer over those sources rather than a second unrelated event universe.

```text
Existing runtime/tool/mission/evidence events
→ normalized projection adapter
→ privacy redaction
→ mission/plan/lane correlation
→ durable event reference
→ story aggregation
→ level-specific renderer
```

Everyday receives concise phases. Workspace receives phase and key actions. Studio receives file, command, diff, test, and process details. Expert receives correlated receipts and raw observable evidence.

Private hidden reasoning is not stored or displayed.

---

## 13. Time Travel Foundation

Time Travel is built on existing checkpoints, worktrees, state capsules, evidence, and immutable events.

Initial capabilities:

- List and inspect checkpoints.
- Compare checkpoint state to current state.
- Restore one file or selected changes.
- Create a new branch/worktree from a checkpoint.
- Replay a plan as a new mission.
- Export an evidence bundle.

Historical evidence is immutable. Every restore or replay creates a new auditable action and receipt.

Time Travel is sequenced after the core profile, experience, session, and update contracts. It must not destabilize the Checkpoint 14 data-preservation path.

---

## 14. UI and Compatibility Convergence

### 14.1 Production source rule

All new progressive UI behavior is authored in `ui-v3` and generated into `ui-dist` with release receipts.

### 14.2 Legacy/recovery parity ledger

Create a machine-readable inventory of features still present only in `ui`, including update/recovery actions. Each feature is marked:

```text
migrated | compatibility-only | recovery-only | intentionally-retained | blocked
```

### 14.3 Retirement gate

`ui` may be reduced or retired only after:

- Update and recovery parity exist in `ui-v3/ui-dist`.
- Development fallback and recovery entry have replacements.
- Bookmark/alias migration passes.
- Capture and accessibility tests pass.
- Removal does not reduce emergency recovery capability.

---

## 15. Security Boundaries

1. Electron renderer remains sandboxed with context isolation and narrow preload APIs.
2. Renderer input never selects update URL, installer path, or shell command.
3. Experience level never changes authority.
4. Personalization context excludes permission and credential grants.
5. Secrets remain in the OS vault.
6. Backups, exports, receipts, and diagnostics exclude credential material.
7. Model truth from weak sources cannot override stronger safety-critical evidence silently.
8. Unknown model capability fails closed for required tool/schema/security capabilities.
9. Plugin/MCP updates remain separate from core application updates.
10. ForgeOS compatibility removal requires a verified Nolane-native replacement, not a documentation rename.

---

## 16. Quality and Certification Architecture

### 16.1 Automated gates

- Baseline and retention gate.
- Documentation/identity drift gate.
- Composition-root and route-facade parity tests.
- UI source/build/receipt tests.
- Model schema, migration, provenance, discovery, evaluation, and routing tests.
- Personalization mapping, provenance, runtime-consumption, and non-escalation tests.
- Direct experience-switch state matrix.
- Onboarding one-time-only tests.
- Session/window/draft restoration tests.
- Update scheduling, streaming, IPC, staging, install, health, snapshot, and recovery tests.
- Execution Story correlation and redaction tests.
- Time Travel immutability and restore tests.
- Full repository suite and release matrix.

### 16.2 Real Windows exit gate

Real Windows CP13 → CP14 update replay is a **Checkpoint 14 release gate**, not deferred to Checkpoint 17. It must prove:

- Update detection and localized notification.
- Signed download and staging.
- Install and automatic relaunch.
- Same app identity and userData path.
- No onboarding recurrence.
- Exact settings/project/mission count preservation.
- Draft/route/experience restoration.
- Vault credential continuity.
- Recovery behavior for installer cancellation, migration failure, and startup failure.

### 16.3 External claims

Provider-real compatibility, Windows accessibility certification, Authenticode status, performance on target 8 GB hardware, and full substrate parity remain scoped claims requiring their own receipts.

---

## 17. Target Milestone Structure

```text
Checkpoint 14 — Trust, Adoption & Autonomy
├── Source identity and architecture alignment
├── Composition/router modularization without behavior loss
├── Canonical Model Truth completion
├── Personalization projection and runtime consumption
├── First-run onboarding
├── Direct permanent Experience Switcher
├── Session/draft/window restoration
├── Unified Execution Story
├── Safe GitHub update UX
├── Migration/snapshot/recovery
├── Time Travel foundation
├── Real Windows update replay
└── Complete Delivery receipts

Checkpoint 15 — Marketplace & Team
├── Verified skill marketplace
├── Shared missions
├── Role-based approvals
└── Collaboration audit trail

Checkpoint 16 — Remote Execution Fabric
├── Private workers
├── Scoped remote capability leases
├── Handoff and synchronization
└── Remote evidence receipts

Checkpoint 17 — Stable Production Certification
├── Long-duration dogfood
├── Full performance hardening
├── External accessibility and security review
├── Broad provider/platform certification
└── Stable release readiness
```

---

## 18. Architectural Decisions

1. **Electron remains the desktop platform.** It is already the real desktop shell.
2. **The custom signed updater remains authoritative.** Electron Builder creates the installer; Nolane’s signed manifest remains the trust boundary.
3. **`ui-v3` is source and `ui-dist` is the production build.** `ui` remains compatibility/recovery until its retirement gate passes.
4. **ForgeOS is acknowledged as a packaged compatibility/authority substrate.** It is not renamed away or removed without capability parity evidence.
5. **NolaneNative remains absent from production runtime/package paths.** Historical provenance remains in notices/evidence.
6. **Personalization values remain in layered Settings.** A profile service adds schema, provenance, history, export, recommendations, and runtime-safe projection.
7. **The advanced model registry is canonical.** The provider registry is a compatibility projection and model-management remains the policy/health/dossier plane.
8. **No cloud/local model question appears in onboarding.** Model/provider configuration occurs contextually or in advanced Settings.
9. **Experience switching is direct and reversible.** A cyclic-only localStorage toggle is insufficient.
10. **Onboarding completion is independent of application version.** Existing users never re-enter first-run setup after an update.
11. **User data remains outside the install directory.** Updates replace binaries and migrate schemas, not user identity.
12. **Migrations are journaled, snapshot-backed, and recoverable.** Silent reset is forbidden.
13. **Observable activity is shown without exposing private hidden reasoning.** Files, commands, tools, skills, tests, models, approvals, evidence, and outcomes are appropriate.
14. **Real Windows update replay is a Checkpoint 14 exit gate.** Installer generation alone is not sufficient.
15. **Architecture debt is reduced through extraction, not a big-bang rewrite.** `src/app.mjs` and `src/server/routes.mjs` remain compatibility facades during migration.

---

**Final architectural assessment:** Checkpoint 13 already contains a broad operational agent runtime, progressive UI source/build pipeline, model intelligence foundation, layered settings, Electron packaging, and a strong signed-update trust chain. Checkpoint 14 must converge and complete those systems—not create parallel replacements—and must correct the source identity, UI, model, settings, updater, and modularity gaps that are visible in the actual repository.
