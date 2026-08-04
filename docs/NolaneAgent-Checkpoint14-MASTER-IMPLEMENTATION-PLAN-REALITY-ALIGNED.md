# Nolane Agent — Master Implementation Plan (Reality-Aligned Revision)

**Target milestone:** Checkpoint 14 — Trust, Adoption & Autonomy  
**Document type:** Whole-project implementation plan  
**Verified baseline:** Checkpoint 13 — Progressive Experience  
**Baseline source commit:** `72f35b57aa32299bb4369eb84759c489b03ce697`  
**Primary constraints:** No feature loss, no data loss, no fake UI, no duplicate source of truth, no update that reopens first-run setup  
**Revision date:** 2026-08-03

---

## 1. Definition of Done

Checkpoint 14 is complete only when all conditions below are true.

### Product adoption

1. A fresh user can start through four or fewer compact onboarding screens or use recommended defaults immediately.
2. Onboarding does not ask cloud-versus-local model questions and does not require provider setup.
3. An upgraded Checkpoint 13 user never sees first-run onboarding solely because the application version changed.
4. Personalization is editable, exportable, resettable by scope, and reflected in actual planner/agent/UI behavior where safe.

### Experience continuity

5. Everyday, Workspace, Studio, and Expert have a permanent direct Experience Switcher.
6. Any level can switch directly to any other level; simple ↔ advanced is always visible.
7. Switching preserves conversation, mission, project, draft, attachment references, route context, active file/artifact, approvals, and running work.
8. Switching never changes permission, sandbox, browser/network authority, or autonomy policy.

### Model intelligence

9. `src/model-profiles` is the canonical model truth plane; provider-oriented records are compatibility projections.
10. Model discovery, field observations, evaluation receipts, freshness, conflicts, and relevant health history are durable and scoped.
11. Models used for production tool execution have verified context/output and tool-conformance evidence or fail closed with an exact explanation.
12. The progressive UI exposes catalog, dossier, comparison, and routing explanation surfaces using real management APIs.
13. Unknown model data is never shown as false, zero, unsupported, or free.

### Transparency

14. Agent activity visibly reports relevant file reads, searches, commands, tools, skills, subagents, edits, tests, approvals, model choices, outputs, failures, and recovery actions.
15. Everyday shows a concise Execution Story; Expert can drill into correlated receipts and observable evidence.
16. No private hidden chain-of-thought is requested, stored, or exposed.

### Updates and preservation

17. A version tag produces the Windows NSIS installer, signed Nolane update metadata, checksums, and release receipts.
18. Installed Electron clients perform delayed and periodic update checks after healthy startup.
19. The new progressive UI notifies users and shows download/staging/install state at all four experience levels.
20. A user can choose **Update and restart**.
21. The installer upgrades the application and explicitly relaunches the new executable.
22. The new version restores the prior session without repeating onboarding.
23. Settings, personalization metadata, projects, missions, checkpoints, memory, model metadata, plugin/MCP trust, credentials, drafts, route, window state, and update preferences remain intact.
24. Update or migration failure enters bounded recovery and never silently resets data.
25. Real Windows CP13 → CP14 replay passes before Complete Delivery.

### Source and architecture integrity

26. `README.md` and `docs/ARCHITECTURE.md` accurately describe Nolane Agent Checkpoint 14 and acknowledge the real compatibility substrates.
27. `src/app.mjs` and `src/server/routes.mjs` are reduced through behavior-preserving domain extraction while remaining compatibility facades.
28. `ui-v3` remains the source; `ui-dist` remains the generated production build; `ui` remains only for declared compatibility/recovery responsibilities.
29. Full repository tests, release matrix, clean-room build, route/settings/UI retention, packaging, real UI capture, and evidence export pass.

---

## 2. Delivery Strategy

Checkpoint 14 is implemented as guarded workstreams. No workstream may merge if it breaks the retention contract or creates a second source of truth.

```text
0. Freeze and truth ledger
→ 1. Source identity and architecture alignment
→ 2. Composition/router/UI convergence
→ 3. Versioned product-state contracts
→ 4. Canonical Model Truth convergence
→ 5. Model discovery/evaluation/freshness completion
→ 6. Model Catalog, Dossier, Comparison and routing explanation
→ 7. Personalization projection and runtime consumption
→ 8. Direct Experience Switcher
→ 9. First-run onboarding
→ 10. Session/draft/window restoration
→ 11. Desktop update coordinator and streaming staging
→ 12. Update UX, install, relaunch, migration and recovery
→ 13. Unified Execution Story
→ 14. Time Travel foundation
→ 15. Full regression and real Windows certification
→ 16. Complete Delivery
```

Core profile, experience, and update work is blocking. Time Travel is sequenced later and may not destabilize data preservation.

---

## 3. Workstream 0 — Baseline Freeze and Truth Ledger

### 3.1 Tasks

- Create `checkpoint-14-trust-adoption-autonomy` from the clean Checkpoint 13 release commit.
- Record the baseline source commit, source ZIP SHA-256, Git bundle verification, installer identity, route count, domain count, settings count, UI inventory, model catalog receipt, tests, release matrix, and artifacts.
- Preserve Checkpoint 13 delivery artifacts as immutable comparison inputs.
- Generate a source-truth ledger that distinguishes:
  - implemented and wired,
  - implemented but not UI-wired,
  - compatibility-only,
  - mock/contract tested,
  - external certification required,
  - planned only.

### 3.2 Verified baseline assertions

The retention verifier must preserve or explicitly migrate:

- 4 progressive experience levels.
- 8 global destinations.
- 18 Settings categories and 84 existing fields.
- 14 Control Plane domains.
- 398 route/pattern entries across 98 backend domains.
- `desktop/main.cjs`, preload bridge, runtime supervisor, and update controller.
- NSIS app ID, executable identity, GUID, and `deleteAppDataOnUninstall: false`.
- `ui-v3`, generated `ui-dist`, and declared legacy/recovery fallback behavior.
- Provider, model, MCP, plugin, hook, browser, terminal, mission, goal, memory, evidence, workroom, recovery, and update APIs.
- Existing compatibility aliases and schemas.
- ForgeOS bridge-backed behavior until replacement receipts pass.

### 3.3 Proposed outputs

```text
requirements/checkpoint-14-retention-contract.json
requirements/checkpoint-14-source-truth-ledger.json
tests/checkpoint-14-retention.test.mjs
tests/checkpoint-14-source-truth.test.mjs
docs/checkpoints/checkpoint-14/BASELINE-TRUTH.md
```

### 3.4 Gate

- Baseline receipt deterministically reproduces the verified counts.
- No Checkpoint 14 implementation starts from an unverified or dirty source snapshot.

---

## 4. Workstream 1 — Source Identity and Architecture Alignment

This workstream directly fixes the documentation drift found in the source.

### 4.1 README correction

Replace the historical “Native Runtime Conversion Wave 6” top-level framing with a current Nolane Agent architecture and release description.

The README must:

- Identify the current product and checkpoint correctly.
- Describe the real progressive UI and Electron packaging.
- State that the legacy external runtime is absent from production runtime/package paths and Nolane Native is the Nolane-owned implementation.
- State that `vendor/forge-os` remains a packaged compatibility/authority substrate used through `ForgeOsBridge`.
- Avoid a false claim that all historical substrate behavior has been replaced natively.
- Link the current architecture, limitations, verification, and delivery documents.

### 4.2 Architecture documentation correction

Replace the stale “Forge Studio 2.16.0 Architecture” identity in `docs/ARCHITECTURE.md` with Nolane Agent architecture based on the verified runtime.

Add explicit sections for:

- Composition root and domain modules.
- Canonical model truth, compatibility registry, and model management.
- Layered settings and Personalization projection.
- `ui-v3 → ui-dist` production pipeline and `ui` fallback.
- Electron updater and release-generated trust configuration.
- ForgeOS compatibility boundary and retirement policy.

### 4.3 Drift prevention

Add a release test that fails when:

- README product/version heading reverts to a historical wave name.
- Architecture title identifies Forge Studio as the current product.
- Documentation claims `config/update.json` is source-controlled when it is release-generated.
- Documentation claims ForgeOS is absent while Electron still packages and runtime still imports it.

### 4.4 Proposed outputs

```text
README.md
docs/ARCHITECTURE.md
docs/COMPATIBILITY-SUBSTRATES.md
tests/product-identity-docs.test.mjs
```

---

## 5. Workstream 2 — Composition, Router, and UI Convergence

### 5.1 Composition-root extraction

Keep `src/app.mjs` as the startup facade, but extract bounded factories.

Proposed modules:

```text
src/bootstrap/create-storage-runtime.mjs
src/bootstrap/create-security-runtime.mjs
src/bootstrap/create-provider-model-runtime.mjs
src/bootstrap/create-repository-runtime.mjs
src/bootstrap/create-agent-runtime.mjs
src/bootstrap/create-experience-runtime.mjs
src/bootstrap/create-update-runtime.mjs
src/bootstrap/runtime-lifecycle.mjs
```

Rules:

- No big-bang rewrite.
- Every extraction begins with characterization tests.
- Public startup behavior, environment variables, paths, receipts, and shutdown behavior remain unchanged.
- Factories return named frozen domain runtimes with explicit lifecycle hooks.
- Hidden circular dependencies are prohibited.

### 5.2 Router extraction

Keep `createRoutes()` in `src/server/routes.mjs` as a compatibility facade. Move bounded route handlers into registrars.

Proposed modules:

```text
src/server/routes/mission-routes.mjs
src/server/routes/model-routes.mjs
src/server/routes/settings-routes.mjs
src/server/routes/update-routes.mjs
src/server/routes/workroom-routes.mjs
src/server/routes/control-plane-routes.mjs
src/server/routes/security-routes.mjs
src/server/routes/compatibility-routes.mjs
```

Requirements:

- Route inventory remains deterministic.
- Request body limits, authorization, telemetry, and error schemas remain intact.
- Generated backend atlas remains 1:1 with the effective route surface.
- Removal requires a migration record, not silent deletion.

### 5.3 UI source-of-truth rule

- Modify `ui-v3`, never hand-edit generated `ui-dist` as the primary source.
- Run the existing UI build to produce `ui-dist` and source-release receipts.
- Create a parity ledger for `ui` features.
- Migrate update/recovery behavior required by the new product into `ui-v3`.
- Retain `ui` only for explicit recovery/compatibility responsibilities until the retirement gate passes.

### 5.4 Proposed outputs

```text
requirements/ui-legacy-parity-ledger.json
tests/ui-root-selection.test.mjs
tests/ui-legacy-parity-retention.test.mjs
tests/bootstrap-domain-parity.test.mjs
tests/routes-facade-parity.test.mjs
```

### 5.5 Gate

- Full route/settings/UI retention remains green after each extraction.
- `ui-dist` receipt validates from the modified `ui-v3` source.

---

## 6. Workstream 3 — Versioned Product-State Contracts

Checkpoint 14 adds state only where no authoritative state already exists.

### 6.1 New records

Create versioned records for:

- Onboarding completion.
- Personalization provenance/history/recommendations metadata.
- Product session restore state.
- Composer drafts and attachment references.
- Experience transition state.
- Window bounds/maximized state.
- Update preferences that are not already Settings values, including deferrals/ignored versions.
- Migration journal.
- Pre-update snapshot manifest.
- Last-known-good release.
- Post-update health.
- Time Travel index metadata.

### 6.2 Do not duplicate existing data

Do not create new stores for:

- Projects, missions, tasks, runs, checkpoints, goals, messages, and durable events already in `StudioStore`.
- Settings values already owned by `SettingsService`.
- Credentials already owned by the vault.
- Model profile truth already owned by the canonical model registry.

New stores hold only missing state or metadata and reference existing IDs.

### 6.3 Proposed modules

```text
src/onboarding/onboarding-state-store.mjs
src/personalization/personalization-metadata-store.mjs
src/session/product-session-state-store.mjs
src/session/composer-draft-store.mjs
desktop/window-state-store.cjs
src/update/update-deferral-store.mjs
src/update/migration-journal.mjs
src/update/pre-update-snapshot.mjs
src/update/last-known-good-store.mjs
src/time-travel/time-travel-index.mjs
```

### 6.4 Shared requirements

- Atomic writes or database transactions.
- `0600` where supported for private local records.
- Versioned schemas and validators.
- Idempotent migrations.
- Unknown-field retention.
- Path confinement.
- No credential material.
- Deterministic receipt for state-changing records.
- Bounded record sizes.

### 6.5 Tests

- Corrupt record handling.
- Interrupted atomic write.
- Concurrent write conflict.
- Older schema migration.
- Newer unknown-field round-trip.
- Path escape rejection.
- Secret scanner against exports/snapshots.

---

## 7. Workstream 4 — Canonical Model Truth Convergence

### 7.1 Preserve the three current layers

Current roles are retained but clarified:

```text
src/model-profiles/*
→ canonical truth and conservative resolution

src/providers/model-profile-registry.mjs
→ provider/UI compatibility projection

src/model-management/*
→ health, policy, recommendation, portfolio and dossier
```

### 7.2 Naming and schema decision

The current compatibility API already emits `nolane.model-profiles.v2`; therefore the new canonical schema must not reuse that name ambiguously.

Required decision before implementation:

- Canonical exact profile schema: `nolane.model-profile.v2` or semantic `2.0.0`.
- Compatibility collection API: retain current schema with migration metadata or advance to `nolane.model-profiles.v3`.
- Deterministic adapters for old clients.

### 7.3 Canonical entity split

Implement explicit entities:

```text
Base Model
Model Snapshot / Version
Deployment Variant
Local Artifact Variant
```

Do not share deployment-specific economics, limits, latency, health, tool behavior, or hardware facts across variants.

### 7.4 Compatibility adapter rule

`src/providers/model-profile-registry.mjs` may keep operational fields expected by current provider/UI code, but:

- It derives canonical truth from `src/model-profiles`.
- It does not silently override stronger canonical evidence.
- Discovery/probe observations are written to the canonical observation path first.
- A compatibility record links the canonical profile receipt.

### 7.5 Proposed modules

```text
src/model-profiles/model-profile-v2-schema.mjs
src/model-profiles/model-profile-migration.mjs
src/model-profiles/model-entity-store.mjs
src/model-profiles/model-field-provenance.mjs
src/model-profiles/model-conflict-resolver.mjs
src/model-profiles/model-freshness-policy.mjs
src/model-profiles/model-compatibility-projection.mjs
```

### 7.6 Gate

- All 567 baseline exact profiles migrate deterministically.
- `null`, `false`, `0`, and empty collections retain distinct semantics.
- Existing model-profile tests and HTTP clients remain compatible.
- Old dossier/profile receipts remain retrievable or explicitly mapped.

---

## 8. Workstream 5 — Model Discovery, Evidence, Evaluation, and Freshness

### 8.1 Durable discovery ledger

The current provider discovery and probe services are real but primarily merge into runtime registries. Add a durable ledger containing:

- Provider/account/region/tier scope.
- Visible model IDs and alias mappings.
- Sanitized response hash.
- Observation time.
- Diff from previous discovery.
- Exact canonical profile/deployment link.

No credential or sensitive raw response is stored.

### 8.2 Discovery scheduler

Implement:

- Manual refresh.
- Refresh after provider connection.
- Periodic refresh with provider-specific backoff.
- Refresh before routing when safety-critical records are expired.
- Offline-safe behavior.
- Duplicate refresh suppression.

### 8.3 Field-level provenance and freshness

Every important field can carry:

```text
path
value
source type/id
scope
observedAt
verifiedAt
confidence
TTL/freshness state
receiptSha256
```

Merge precedence:

1. Official provider API observation.
2. Official provider/model documentation.
3. Signed Nolane evaluation.
4. Trusted catalog import.
5. Family/template inference.
6. Provisional unknown.

Conflicts are recorded and shown; they are not silently hidden.

### 8.4 Evaluation system

Versioned minimum suites:

- Tool schema conformance.
- Strict structured output.
- Repository navigation.
- Single-file bug fix.
- Multi-file change.
- Test generation and repair.
- Refactor safety.
- Long-context retrieval and instruction retention.
- Browser/tool recovery.
- Citation correctness where applicable.
- Security-sensitive policy adherence.
- Latency, throughput, and cost.
- Local hardware/runtime benchmarks for local artifacts.

### 8.5 Runtime observation wiring

Automatically feed bounded execution observations into `ModelManagementService.recordExecution()` or its durable successor from actual provider outcomes.

Record:

- Success/failure.
- Latency.
- Tokens and known cost.
- Tool success.
- Error code.
- Quality/evaluation linkage when available.

Do not rely on the manual `/api/model-management/observations` endpoint as the only source.

### 8.6 Harness recommendations

Populate evidence-backed recommendations for:

- Context strategy.
- Tool schema strategy.
- Patch strategy.
- Retry/fallback strategy.
- Compaction.
- Preferred role/task class.
- Maximum parallel lanes.
- Required verifier/reviewer.

### 8.7 Proposed modules and artifacts

```text
src/model-profiles/model-discovery-ledger.mjs
src/model-profiles/model-discovery-scheduler.mjs
src/model-profiles/model-evaluation-ledger.mjs
src/model-profiles/model-evaluation-runner.mjs
src/model-profiles/model-observation-adapter.mjs
config/model-profiles/nolane-model-profiles.v2.json
config/model-profiles/model-field-provenance-ledger.json
```

### 8.8 Gate

- Connected providers create real discovery records.
- Safety-critical stale records fail closed or force revalidation.
- Tool-enabled production models have conformance receipts.
- No self-reported quality score is treated as verified evidence.

---

## 9. Workstream 6 — Model Catalog, Dossier, Comparison, and Routing Explanation

### 9.1 Reuse existing APIs

The UI must first consume and extend existing management APIs rather than create a duplicate model backend.

Existing capabilities to wire:

- Snapshot.
- Recommendation.
- Portfolio.
- Observation.
- Dossier.
- Provider discovery/probe.

### 9.2 UI modules

Proposed source modules:

```text
ui-v3/views/model-catalog/model-catalog-view.mjs
ui-v3/views/model-dossier/model-dossier-view.mjs
ui-v3/views/model-comparison/model-comparison-view.mjs
ui-v3/views/model-routing/model-routing-explanation.mjs
ui-v3/core/model-intelligence-store.mjs
ui-v3/styles/pages/model-intelligence.css
```

### 9.3 Required behavior

- Search/filter by provider, local/remote, lifecycle, modality, capability, cost, freshness, and confidence.
- Verified/inferred/stale/expired/unknown/conflicted badges.
- Dossier tabs for identity, lifecycle, context, modalities, tools, quality, economics, deployment, policy, evaluations, provenance, and history.
- Compare 2–5 deployment profiles.
- Show selected model, rejected candidates, blockers, warnings, component scores, estimated cost/latency, fallback chain, and receipts.
- Never display unknown as zero or unsupported.

### 9.4 Tests

- Unknown rendering.
- Conflict rendering.
- Dossier receipt linkage.
- Comparison consistency.
- Recommendation replay.
- English/Vietnamese.
- All themes and experience levels.
- No credential exposure.

---

## 10. Workstream 7 — Personalization Projection and Runtime Consumption

### 10.1 Source-of-truth rule

Values remain in `SettingsService` layers. The Personalization Profile is:

- A versioned export/import contract.
- A mapping over current settings paths.
- A provenance/history/recommendation metadata layer.
- A bounded runtime context.

It is not a second independent preference database.

### 10.2 Existing keys are canonical at baseline

Use current values before adding new catalog fields:

```text
experience.level
general.language
general.defaultIntent
personalization.explanationDepth
personalization.responseStyle
personalization.askBeforeAmbiguousChanges
personalization.showReasoningSummary
personalization.preferredDocumentationLanguage
appearance.*
accessibility.*
memory.*
notifications.*
data.*
models.*
updates.*
```

Documentation and onboarding must use enum values accepted by `settings-catalog.mjs`.

### 10.3 Profile service

Proposed modules:

```text
src/personalization/personalization-profile-service.mjs
src/personalization/personalization-profile-schema.mjs
src/personalization/personalization-settings-mapper.mjs
src/personalization/personalization-metadata-store.mjs
src/personalization/personalization-recommendation-service.mjs
src/personalization/personalization-context-compiler.mjs
```

Responsibilities:

- Read effective settings.
- Produce canonical profile export.
- Validate/import with preview.
- Apply accepted changes through `SettingsService.update()`.
- Track source: explicit, onboarding, accepted recommendation, inference proposal, project policy, machine policy, default.
- Preserve unknown fields.
- Maintain preference history and undo metadata.
- Compile safe preferences for planner/agent/UI use.

### 10.4 Runtime wiring

Pass a bounded Personalization Context into:

- Mission plan presentation.
- Agent response style/depth.
- Documentation language.
- Clarification behavior inside permitted scope.
- Execution Story detail.
- Notifications.

Assertions:

- No profile value can grant capability or bypass approval.
- Project/security policy can only tighten behavior.
- Explicit user preference wins over inference.
- Inference produces a suggestion, not an automatic write.

### 10.5 UI

Add a Personalization Overview in Settings with:

- Current values.
- Winning layer.
- Preference source.
- Last change.
- Reset field/group/user profile.
- Import/export preview.
- Recommendation queue.
- Memory/privacy controls separated from “reset settings”.

### 10.6 Tests

- Mapping round-trip.
- Existing enum compatibility.
- Layer precedence.
- Provenance source precedence.
- Import unknown-field retention.
- Non-escalation property tests.
- Agent context excludes restricted fields.
- Explicit choice not overwritten by inference.

---

## 11. Workstream 8 — Permanent Direct Experience Switcher

### 11.1 Replace cyclic-only behavior

The current top-bar pill calls `nextExperience()` and cycles levels. Replace it with a menu/listbox presenting all four destinations.

Proposed modules:

```text
ui-v3/components/experience-switcher/experience-switcher.mjs
ui-v3/components/experience-switcher/experience-switcher.css
ui-v3/core/experience-transition-controller.mjs
ui-v3/core/view-state-bridge.mjs
```

### 11.2 Entry points

- Header/title bar.
- Application menu.
- Command Palette.
- Settings.
- `Ctrl/Cmd + Shift + E` or another conflict-checked shortcut.

### 11.3 Persistence

- Save `experience.level` through `PUT /api/settings` to the user layer.
- Update `localStorage` only as a reconciled cache.
- On boot, load effective Settings and correct stale cache.
- Surface a save failure rather than pretending persistence succeeded.

### 11.4 Transition capture

Capture:

- Route and parameters.
- Conversation, mission, and project IDs.
- Draft and attachment references.
- Selected tab/open file/artifact.
- Review/approval state.
- Summary dock and focus anchor.

### 11.5 Tests

Matrix:

```text
4 source levels × 4 destination levels ×
conversation/mission/project/draft/approval/running-task states
```

Assertions:

- Direct transition.
- Stable IDs.
- No duplicate mission.
- No route loop.
- No background work restart.
- No permission/autonomy change.
- Keyboard/listbox/screen-reader behavior.

---

## 12. Workstream 9 — First-Run Personalization

### 12.1 Product rule

Do not ask cloud/local model and do not force provider connection.

### 12.2 Proposed modules

```text
src/onboarding/onboarding-service.mjs
src/onboarding/onboarding-recommendations.mjs
src/onboarding/onboarding-state-store.mjs
ui-v3/views/onboarding/onboarding-controller.mjs
ui-v3/views/onboarding/onboarding-view.mjs
ui-v3/styles/pages/onboarding.css
```

### 12.3 Screens

#### Screen 1 — Language and primary use

- `system`, `vi`, `en`.
- Chat/everyday.
- Writing/summarization.
- Learning/research.
- Planning/projects.
- Software building.
- Advanced agent operations.

#### Screen 2 — Collaboration

- Explanation depth using existing enum.
- Response style using existing enum.
- Ask-before-ambiguous behavior.
- Execution Story detail preference.

#### Screen 3 — Starting experience and appearance

- Everyday, Workspace, Studio, Expert.
- Existing theme/accent/density/motion values.
- Preview and explicit note that the level is always reversible.

#### Screen 4 — Memory, notifications, and privacy

- Cross-session memory.
- Retention choice.
- Mission/approval/error/update notifications.
- Diagnostics/telemetry preference where supported.

Global actions:

- Use recommended defaults.
- Back.
- Continue.
- Skip for now.

### 12.4 Mapping

Onboarding writes only the user Settings layer through the Personalization Profile service. It also records source=`onboarding` in metadata.

No onboarding answer silently enables unrestricted autonomy. Recommended software/advanced profiles remain supervised unless the user later changes authority in the dedicated permissions surface.

### 12.5 First-run detection

1. Valid onboarding completed → skip.
2. Existing settings/projects/missions/messages → upgraded installation; mark or infer skip.
3. Managed policy disables onboarding → skip.
4. Otherwise show onboarding.

### 12.6 Tests

- Fresh install.
- Skip.
- Recommended defaults.
- Existing-user upgrade.
- App version update does not reset onboarding.
- Close/reopen mid-flow.
- Keyboard-only completion.
- Immediate language preview.
- No provider/cloud/local question.
- No autonomy escalation.

---

## 13. Workstream 10 — Session, Draft, and Window Restoration

### 13.1 Persist only missing product state

Persist at bounded intervals and key transitions:

- Active conversation/thread ID.
- Mission ID.
- Project ID.
- Composer draft.
- Attachment references.
- Current route and experience level.
- Open file/artifact.
- Selected tab/panel state.
- Window bounds and maximized state.

Mission/checkpoint state remains in existing durable stores.

### 13.2 Electron integration

Extend `desktop/main.cjs` through small helpers rather than growing it further:

```text
desktop/window-state-store.cjs
desktop/post-update-launch.cjs
```

Requirements:

- Restore bounds inside active displays.
- Flush UI/session state before normal quit and update install.
- Pass only a fixed post-update launch reason.
- Avoid a second-instance race.
- Never auto-rerun a destructive command.

### 13.3 Safety

- Store references, not copied secrets.
- Revalidate workspace trust before restoring file paths.
- Missing project/attachment produces a recoverable notice.
- Active work resumes only from a durable checkpoint.

### 13.4 Tests

- Normal restart.
- Crash restart.
- Update restart.
- Removed monitor.
- Missing project/path/attachment.
- Pending approval.
- Active mission checkpoint.
- Corrupt restore record.

---

## 14. Workstream 11 — Desktop Update Coordinator and Streaming Staging

### 14.1 Retain existing trust components

Extend, do not replace:

```text
src/update/update-service.mjs
src/update/update-configuration.mjs
desktop/update-controller.cjs
desktop/preload.cjs
desktop/main.cjs
electron-builder.config.cjs
build/installer.nsh
.github/workflows/release.yml
scripts/prepare-update-trust.mjs
```

`config/update.json` and the public key remain release-generated artifacts.

### 14.2 Add coordinator

Proposed file:

```text
desktop/update-coordinator.cjs
```

Responsibilities:

- Start after runtime/main UI health.
- Read effective update settings through a trusted runtime API.
- Delayed startup check: 45–120 seconds.
- Periodic check: approximately every 8 hours with jitter.
- Manual rate-limited check.
- Backoff on failure/offline.
- Auto-download only when enabled.
- Persist deferred/ignored versions.
- Detect active mission and install conflicts.
- Publish state/progress to renderer.
- Suppress duplicate checks/downloads.

### 14.3 IPC contract

Narrow methods with no renderer-supplied URL/path/command:

```text
getUpdateState()
checkForUpdates()
downloadAvailableUpdate()
deferUpdate()
ignoreVersion()
installUpdateAndRestart()
onUpdateState(listener)
```

### 14.4 Streaming staging

Refactor `UpdateService.stage()`:

1. Verify manifest.
2. Create confined temp file under `<dataDir>/updates`.
3. Stream chunks to disk.
4. Enforce max bytes and content-length consistency.
5. Incrementally hash.
6. Emit progress.
7. Flush/sync/close.
8. Verify exact bytes, hash, PE header, exact package name.
9. Atomically rename.
10. Atomically write marker and verification receipt.

### 14.5 Failure handling

- Hash/identity/PE failure deletes untrusted executable.
- Disk-full returns an exact error.
- Cancellation closes streams and writes no executable marker.
- Interrupted process leaves a bounded resumable or removable partial file.
- Redirect escape fails closed.

### 14.6 Tests

- Scheduling/jitter/rate limit.
- Offline/backoff.
- Channel changes.
- Deferred/ignored version.
- Active mission protection.
- Renderer injection rejection.
- Chunked success.
- Oversize/wrong length/wrong hash/wrong PE.
- Disk full/cancel/interruption.
- Atomic marker creation.

---

## 15. Workstream 12 — Update UX, Install, Relaunch, Migration, and Recovery

### 15.1 Shared UI state

Proposed source modules:

```text
ui-v3/core/update-state-controller.mjs
ui-v3/components/update-notice/update-notice.mjs
ui-v3/components/update-notice/update-notice.css
ui-v3/views/settings/update-settings-adapter.mjs
ui-v3/views/release/release-center.mjs
```

Build output is generated into `ui-dist`.

### 15.2 Level-specific UX

#### Everyday

- Version.
- “Your conversations and settings will be kept.”
- Update and restart.
- Later.
- What’s new.

#### Workspace/Studio

Additionally:

- Download progress.
- Running mission/checkpoint status.
- Install after mission.
- Required disk space.

#### Expert

Additionally:

- Channel.
- Manifest signature.
- Repository/tag/commit.
- Asset name and SHA-256.
- Migration plan.
- Last-known-good release.
- Recovery record.

### 15.3 Pre-install sequence

- Reverify staged installer.
- Flush Settings and Personalization metadata.
- Persist draft/route/session/window state.
- Ask active missions to checkpoint.
- Create pre-update snapshot.
- Write migration/recovery record.
- Enter quiescing state.
- Launch installer.
- Quit only after successful process launch.

### 15.4 NSIS relaunch contract

Update `build/installer.nsh` and packaging configuration so update installation:

- Retains app ID/GUID and userData identity.
- Upgrades application files only.
- Does not run onboarding.
- Relaunches the new `NolaneAgent.exe`.
- Passes a fixed safe `--post-update` flag or equivalent.
- Avoids concurrent old/new instances.

### 15.5 Post-update health

Healthy only after:

- Electron window exists.
- Runtime is running.
- UserData identity matches.
- Settings/Personalization load.
- Project/mission stores open.
- Migrations complete.
- Main UI renders.
- Restore attempt completes with success or exact recoverable status.

### 15.6 Migration and snapshot framework

Create a machine-readable durable-store registry. Implement:

- Migration registry by source/target schema.
- Idempotent steps.
- Pre/post validation.
- Dry-run mode.
- Journal receipts.
- Snapshot retention/disk budget.
- Credential exclusion.
- Last-known-good binary and metadata state.

### 15.7 Recovery UI

Minimal authenticated recovery surface:

- Exact failed step.
- Export diagnostics.
- Retry migration.
- Start last-known-good binary.
- Restore selected metadata snapshot.
- Open data directory.
- Never default to global reset.

### 15.8 Tests

- Successful install/relaunch.
- Elevation cancelled.
- Installer launch failure.
- Second-instance race.
- Runtime startup failure.
- Migration failure/mid-step crash.
- Corrupt database/profile/settings.
- Snapshot restore.
- Unknown-field retention.
- Credential exclusion.
- No onboarding reset.

---

## 16. Workstream 13 — Unified Execution Story

### 16.1 Reuse existing sources

Normalize projections from:

- Durable event hub and StudioStore events.
- Mission timeline and state-progress services.
- Sovereign Kernel.
- Tool broker, shell, terminal, file operations.
- Skills, MCP, browser, plugins, hooks.
- Tests, verification, review, approvals.
- Model router/manager.
- Subagents and artifact store.

Do not create a disconnected duplicate event system.

### 16.2 Event projection schema

Each projected event carries:

- Event ID and source event reference.
- Mission/thread/plan/task/lane correlation.
- Category.
- User-safe title/summary.
- Timestamp/duration/state.
- File/tool/command/model/artifact references.
- Redacted bounded metadata.
- Evidence/receipt references.
- Minimum visibility level.

### 16.3 Story aggregation

Example:

```text
Understanding request
→ Read 14 files
→ Found likely cause
→ Proposed 6-step plan
→ Changed 3 files
→ Ran 48 tests
→ Waiting for review
```

### 16.4 Tests

- Ordering and deduplication.
- Cross-restart continuation.
- Subagent correlation.
- Failed/retried steps.
- Redaction.
- Level-specific detail.
- No private reasoning exposure.

---

## 17. Workstream 14 — Time Travel Foundation

### 17.1 Build on existing state

Use existing mission checkpoints, worktrees, state capsules, evidence, artifacts, and immutable events.

Proposed modules:

```text
src/time-travel/checkpoint-index.mjs
src/time-travel/state-comparator.mjs
src/time-travel/restore-planner.mjs
src/time-travel/replay-service.mjs
```

### 17.2 Initial capabilities

- List checkpoints.
- Compare checkpoint/current state.
- Restore one file or selected changes.
- Create branch/worktree from checkpoint.
- Replay plan as a new mission.
- Export evidence bundle.

### 17.3 Safety

- Historical evidence remains immutable.
- Restore/replay creates a new receipt.
- Dirty trees require branch/worktree or explicit resolution.
- Destructive restore requires confirmation.
- Cross-version restore validates schema compatibility.

### 17.4 Gate

Time Travel may not merge until update snapshots, migrations, and session restoration are stable, because it shares data-preservation primitives.

---

## 18. Workstream 15 — Test, Release, and Real Windows Certification

### 18.1 Targeted gates

- Baseline truth and retention.
- Product identity/docs drift.
- Composition/router parity.
- UI source/build/receipt and legacy parity.
- Model schema/migration/provenance/freshness/conflict/evaluation.
- Model dossier/comparison/routing explanation.
- Personalization mapping/provenance/runtime consumption/non-escalation.
- Onboarding one-time behavior.
- Direct experience switching and state preservation.
- Session/draft/window restore.
- Update coordinator/streaming/IPC/staging.
- Install/relaunch/health/migration/snapshot/recovery.
- Execution Story correlation/redaction.
- Time Travel immutability/restore.
- Data-loss mutation tests.

### 18.2 Full regression

Run:

- Full Node suite.
- Go tests.
- Python tests.
- UI token validator.
- UI capability/route audit.
- Settings catalog audit.
- i18n audit.
- Theme visual audit.
- Accessibility smoke audit.
- Full release matrix.

### 18.3 Clean-room

From published source ZIP:

- No `.git` dependency.
- No preinstalled `node_modules` dependency.
- Install from lockfile.
- Generate release trust configuration only through documented secure inputs.
- Build `ui-v3 → ui-dist`.
- Run full suite.
- Build Windows artifacts on Windows runner.
- Verify source/archive/artifact identity.

### 18.4 Real Windows update matrix

| Source | Target | User state |
|---|---|---|
| CP13 installed | CP14 beta | Fresh user |
| CP13 installed | CP14 beta | Existing settings; no onboarding record |
| CP13 installed | CP14 beta | Active draft |
| CP13 installed | CP14 beta | Active checkpointed mission |
| Prior CP14 beta | Newer CP14 beta | Plugins/MCP/configured project |
| CP14 beta | CP14 stable candidate | OS-vault credentials and personalization history |

For each:

- Update detected.
- Localized notice visible.
- Download verified.
- Install and automatic restart.
- Same userData identity.
- No onboarding recurrence.
- Exact before/after settings and profile comparison.
- Exact project/mission/checkpoint count comparison.
- Draft, route, window, and experience restored.
- Vault credentials available.
- No unexpected deletion.
- Recovery scenario behaves as designed.

### 18.5 External scope labels

Do not claim the following without explicit receipts:

- Provider-real parity for every supported provider/model.
- Authenticode-signed production installer if signing secret/certificate was unavailable.
- Full accessibility certification.
- 8 GB Windows performance certification.
- Complete ForgeOS replacement.

---

## 19. Workstream 16 — Complete Delivery

### 19.1 Required artifacts

- Source ZIP.
- Windows NSIS `.exe`.
- Electron portable/debug package where applicable.
- Update payload and signed metadata.
- Public-key fingerprint and signed manifest example.
- VS Code extension.
- Full release matrix JSON/Markdown.
- Full test receipt.
- Clean-room certification.
- Real Windows update replay report.
- Data preservation before/after report.
- Model truth coverage/provenance/evaluation report.
- Personalization mapping/provenance/migration report.
- Migration registry and receipts.
- UI captures for onboarding, four experience levels, model surfaces, update states, Execution Story, recovery, and Time Travel.
- Git bundle.
- Binary change-set from Checkpoint 13.
- SHA-256 manifest for every artifact.

### 19.2 Delivery truth

The delivery report separates:

```text
locally verified
Windows verified
provider-real verified
externally gated
planned follow-on
```

No single `PASS` receipt may be used to imply broader certification than its scope.

---

## 20. Explicit Non-Goals

Checkpoint 14 does not:

- Ask cloud versus local model during onboarding.
- Require provider connection before entering the app.
- Create a second settings database as the Personalization source of truth.
- Create a second independent model registry.
- Remove Expert capability to simplify Everyday.
- Grant permissions because Expert mode is selected.
- Auto-install a core update without user action.
- Trust an unsigned or identity-mismatched GitHub asset.
- Store credentials in settings, profile export, snapshot, diagnostics, or migration files.
- Delete `ui` before update/recovery parity and retirement gates pass.
- Claim ForgeOS is absent while it remains packaged and used.
- Claim complete provider/Windows/platform parity from mock or contract tests.
- Claim rollback safety before real Windows replay passes.

---

## 21. Final Acceptance Checklist

### Source truth and architecture

- [ ] README and architecture identify current Nolane Agent correctly.
- [ ] ForgeOS compatibility role is accurately documented.
- [ ] NolaneNative remains absent from production paths.
- [ ] Composition root is domain-extracted with parity.
- [ ] Router is domain-extracted with 398-route retention or explicit migration.
- [ ] `ui-v3 → ui-dist` receipt passes.
- [ ] Legacy/recovery parity ledger is complete.

### Model truth

- [ ] Canonical schema and compatibility decision locked.
- [ ] 567 baseline profiles migrate deterministically.
- [ ] Base/snapshot/deployment/local artifact separation works.
- [ ] Field provenance, freshness, and conflict records work.
- [ ] Discovery records are durable for connected providers.
- [ ] Tool-enabled production models have conformance receipts.
- [ ] Runtime observations feed health/policy automatically.
- [ ] Catalog, dossier, comparison, and routing explanation work.
- [ ] Unknown never renders as false/zero.

### Personalization and onboarding

- [ ] Settings remain authoritative.
- [ ] Profile export/import/provenance/history works.
- [ ] Runtime-safe Personalization Context is consumed.
- [ ] No security/autonomy escalation is possible.
- [ ] First run is four screens or fewer.
- [ ] Recommended defaults enter immediately.
- [ ] No cloud/local question or provider requirement.
- [ ] Existing-user update skips onboarding.

### Experience

- [ ] Direct all-to-all switcher is visible.
- [ ] Everyday → Expert and Expert → Everyday work directly.
- [ ] Switch persists through user Settings.
- [ ] Cache/effective settings reconcile.
- [ ] Draft/attachments/mission/project/route/open artifact survive.
- [ ] No permission/autonomy change.
- [ ] Keyboard and screen-reader behavior passes.

### Updates and preservation

- [ ] GitHub tag creates exact x64 NSIS installer and signed feed.
- [ ] Client checks after healthy startup and periodically.
- [ ] Localized notification appears in all levels.
- [ ] Streaming download shows progress and verifies identity/hash/PE.
- [ ] Update and restart relaunches new executable.
- [ ] Same userData and session restore.
- [ ] Settings/projects/missions/checkpoints/memory/model metadata retained.
- [ ] Credentials remain in OS vault.
- [ ] Onboarding does not reappear.
- [ ] Failed update enters recovery without reset.
- [ ] Real Windows replay passes.

### Transparency and release

- [ ] Observable agent actions are represented in Execution Story.
- [ ] Expert evidence drill-down is available.
- [ ] No private hidden reasoning is exposed.
- [ ] Time Travel preserves evidence immutability.
- [ ] Full repository suite passes.
- [ ] Full release matrix passes.
- [ ] Clean-room passes.
- [ ] Archive/artifact identity passes.
- [ ] Complete Delivery and checksums exported.

---

**Final implementation assessment:** Checkpoint 14 must complete and converge systems that already exist in Checkpoint 13. The plan therefore prioritizes canonicalization, persistence, runtime wiring, UI parity, state continuity, and real certification over creating parallel services or adding routes that only look complete.
