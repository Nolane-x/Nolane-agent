# Nolane Agent — Checkpoint 14 Foundation 1 Execution Report

**Milestone:** Checkpoint 14 — Trust, Adoption & Autonomy  
**Delivery slice:** Foundation 1 — Product truth, adoption, durable resume, trusted desktop updates, streaming staging, and pre-update recovery evidence  
**Baseline:** `72f35b57aa32299bb4369eb84759c489b03ce697`  
**Implementation commit:** `4476c021d26b10a6c92bd0aeff2c35c7b0afff79`  
**Generated:** 2026-08-03T16:33:11Z  
**Status:** Source implementation verified locally; external Windows and remaining Checkpoint 14 gates remain open.

---

## 1. Executive result

Foundation 1 implements the first dependency-ordered portion of the reality-aligned Checkpoint 14 architecture and plan without replacing the existing Checkpoint 13 product substrate.

The delivery adds:

- a bounded Trust & Adoption composition boundary;
- a Personalization Profile projection over layered Settings rather than a second preference database;
- one-time onboarding with recommended defaults and no cloud/local provider question;
- a direct any-to-any Experience Switcher with durable view-state preservation;
- session, composer draft, route, and Electron window restoration;
- a desktop update coordinator with a narrow renderer IPC contract;
- progressive update notices across Everyday, Workspace, Studio, and Expert;
- streamed installer staging with incremental SHA-256 verification and atomic pending markers;
- a fixed NSIS post-update relaunch contract compatible with the Checkpoint 13 update switch;
- core pre-update snapshot, migration-journal, and recovery evidence foundations.

Checkpoint 13 parity remains intact. The implementation does **not** claim that the whole Checkpoint 14 milestone is complete.

---

## 2. Change custody

| Item | Value |
|---|---|
| Baseline commit | `72f35b57aa32299bb4369eb84759c489b03ce697` |
| Implementation commit | `4476c021d26b10a6c92bd0aeff2c35c7b0afff79` |
| Files changed | 120 |
| Insertions | 9,975 |
| Deletions | 861 |
| Branch | `checkpoint-14-trust-adoption-autonomy` |
| Package version | `5.0.0-beta.6` |

The package version was intentionally not advanced in this foundation slice. Versioning and publication remain release-stage responsibilities after the remaining certification gates.

---

## 3. Implemented architecture

### 3.1 Product truth and retention lock

Added current-product documentation, compatibility-substrate documentation, source-truth contracts, retention assertions, and a Foundation verifier. The contract retains:

- four experience levels;
- eight global destinations;
- all 18 Settings categories and 84 fields;
- all 14 Control Plane domains;
- legacy compatibility and recovery surfaces;
- provider, model, MCP, plugin, hook, mission, project, memory, evidence, workroom, and updater contracts.

The verified backend inventory is now **415 routes across 101 domains**, with no Checkpoint 13 route-removal finding.

### 3.2 Trust & Adoption composition boundary

Added `src/adoption/trust-adoption-foundation.mjs` as a compatibility-preserving subsystem boundary for the new services. This avoids adding six direct construction responsibilities to `src/app.mjs`.

The adaptive microkernel budget remains unchanged and passes at:

- 160 static imports;
- 179 constructor sites.

No budget threshold was relaxed to hide the new dependencies.

### 3.3 Personalization Profile projection

Implemented Personalization as a versioned projection over the existing layered `SettingsService` authority:

```text
Defaults < User < Project < Local machine
```

Capabilities include:

- canonical profile reads;
- bounded preference patching;
- source and history metadata;
- deterministic receipt hashing;
- import preview and explicit apply;
- a bounded runtime context that excludes authority-sensitive, credential, memory-governance, and updater-control fields.

Personalization cannot raise filesystem, shell, browser, network, model, or autonomy authority.

### 3.4 First-run onboarding

Implemented a separate durable onboarding state with:

- four compact screens;
- recommended defaults;
- skip and resume behavior;
- immediate language and appearance mapping;
- Settings-based personalization writes;
- no cloud/local model question;
- no mandatory provider setup;
- no silent unrestricted autonomy;
- mature-installation and post-update bypass;
- idempotent completion and skip operations.

Application version changes do not reset onboarding state.

### 3.5 Direct Experience Switcher

Replaced the prior cyclic-only experience action with a shell-level direct selector supporting all pairwise transitions among:

- Everyday;
- Workspace;
- Studio;
- Expert.

The transition flow captures view state, persists the user-level experience preference through the Personalization API, updates the local projection, and rolls back on persistence failure.

The view-state bridge preserves bounded route, draft, focus, scroll, and nearest-level context. Changing UI level does not alter agent authority.

### 3.6 Session, draft, route, and window restoration

Added atomic, versioned, path-confined stores for:

- active route and experience;
- composer draft up to the defined bound;
- selection, intent, and model-choice metadata;
- attachment references rather than copied files or secrets;
- Electron window bounds and maximized state.

The implementation rejects credential-like fields and unsafe absolute paths, handles corrupt records fail-closed, uses restrictive file mode where supported, restores windows onto active displays, and clears submitted drafts after mission creation.

### 3.7 Desktop update coordinator and progressive UX

Added a desktop-owned coordinator that:

- begins after runtime health;
- schedules delayed and periodic checks;
- respects update channel and auto-download settings;
- persists deferred and ignored versions;
- suppresses duplicate checks;
- blocks install while an active mission cannot safely checkpoint;
- emits one shared update state to all progressive UI levels.

The preload contract exposes only fixed operations. The renderer cannot inject an installer URL, filesystem path, or shell command.

Update presentation is progressively disclosed:

- Everyday: version, preservation promise, update/restart, later, and release summary;
- Workspace/Studio: operational and active-mission details;
- Expert: manifest, tag, commit, asset, hash, and recovery metadata.

### 3.8 Streaming staging and trusted marker creation

Refactored installer staging to:

1. write chunks into a confined `.partial` file;
2. enforce byte bounds while streaming;
3. compute SHA-256 incrementally;
4. synchronize the file before finalization;
5. validate length, digest, PE header, release identity, and exact asset name;
6. atomically rename the verified installer;
7. write the pending marker only after all verification succeeds.

Cancellation, wrong length, wrong hash, invalid PE data, and interrupted streams do not leave an executable pending marker.

### 3.9 Install, relaunch, snapshot, and recovery foundation

The install path now:

- flushes UI session and draft state;
- calls runtime update preparation;
- blocks unsafe installation while work remains active;
- creates a consistent core SQLite snapshot using `VACUUM INTO`;
- snapshots bounded product metadata with hashes;
- excludes credential material;
- writes a migration journal and recovery record;
- re-verifies the staged installer in Electron;
- launches NSIS with a fixed update switch;
- supports both the new `/UPDATED` contract and the Checkpoint 13 legacy `--updated` switch;
- relaunches the application with fixed `--post-update` state;
- records the post-update runtime-ready migration step.

This is the source contract and local verification foundation. Real Windows installation, process replacement, relaunch, and data-preservation replay remain mandatory external certification gates.

---

## 4. Verification results

### 4.1 Exact-commit Node regression

The full Node runner completed against implementation commit `4476c021d26b10a6c92bd0aeff2c35c7b0afff79`:

| Metric | Result |
|---|---:|
| Test files | 832 / 832 PASS |
| Tests | 2,316 PASS |
| Failed files | 0 |
| Commit-keyed cache entries | 832 |
| Node | v22.16.0 |
| Platform | Linux x64 |

The execution environment imposes a 40-minute process cap. The suite therefore completed through multiple resumptions using the repository's exact-commit cache. No source changes occurred between resumptions. An orphaned VS Code extension lock left by a forcibly terminated runner was removed only after confirming its PID no longer existed; the affected serial test then completed successfully.

### 4.2 Targeted and compatibility gates

| Gate | Result |
|---|---|
| Checkpoint 14 Foundation targeted tests | 73 / 73 PASS |
| Checkpoint 14 Foundation verifier | PASS |
| Checkpoint 13 Progressive Experience verifier | PASS |
| UI V3 production build | PASS — 110 files |
| UI source-release receipt | PASS |
| UI capability audit | PASS — 22 capabilities |
| UI token graph | PASS — no undefined variables, cycles, or raw colors |
| Electron installer contract | PASS |
| Version coherence | PASS |
| Evidence freshness | PASS — 198 / 198 |
| Master acceptance ledger freshness | PASS — 10,603 evidence hashes |
| Go launcher | PASS |
| Go native PTY | PASS |
| Go credential helper | PASS |
| Python SDK and held-out fixture tests | 5 PASS |
| Git whitespace/error check | PASS |

### 4.3 Evidence receipts

| Evidence | Receipt SHA-256 |
|---|---|
| Checkpoint 14 Foundation verification | `d974c9d431b64b9d17062ccf308f6c78d1882d19c6c60d2682eb232a23b7fff5` |
| Checkpoint 13 verification | `8c648aee2782538299a824474cbcbfaf41199d26fe5a66ac7e182f93418f4e6c` |
| UI build manifest | `69d4feae15f96c8780dc5f461271182ea38749d1466f58ed182dad1ab729f481` |
| UI source-release | `25506e20d0449bc0464e4997b6509c306ae41238fd955f9ce4bd39dd83ed0de6` |
| UI verification | `6fedb9f1a644dcf1b88e6e66e8b03d3698e0cca0cdd836971a586dd053d21e9b` |
| Master acceptance ledger | `6d371a20224a2a839949da950f0490ef22aab8f212da0e3364974baf4da88abf` |
| Evidence freshness | `be29ead6594247a50f1afc8de4eff3166f705536d225ef391d686eab7e1b9da5` |
| Version coherence | `f07833f044a098917d9835db4a5aad6c621b9c846aae70b95fb3c107afbcf634` |

The master ledger records 1,460 canonical requirements: 1,372 verified and 88 explicitly external. The complete-product claim remains locked.

---

## 5. Explicit non-claims and open gates

This report does **not** claim any of the following:

- complete Checkpoint 14 delivery;
- Model Profile v2 convergence;
- Unified Execution Story;
- Time Travel;
- full multi-store snapshot and automatic rollback;
- resumable update downloads and renderer progress streaming;
- a complete release matrix run for this slice;
- real Checkpoint 13 → Checkpoint 14 Windows installer replay;
- Windows post-install relaunch certification;
- Authenticode production signing;
- external screen-reader certification;
- Windows 8 GB performance certification;
- real-provider or local-hardware model certification.

The Foundation verifier keeps these open:

1. `model-profile-v2-convergence`
2. `windows-update-replay`
3. `migration-snapshot-and-recovery`
4. `execution-story`
5. `time-travel`
6. `streaming-update-progress-and-resume`
7. `windows-post-install-relaunch-certification`
8. `full-multi-store-snapshot-and-rollback`
9. `resumable-download-and-renderer-progress-stream`

---

## 6. Recommended next implementation order

The next source work should preserve the established dependency graph:

```text
Foundation 1 verified
→ Model Profile v2 convergence and field-level provenance
→ Full durable-store inventory and migration registry
→ Multi-store snapshot/restore planner
→ Update progress and resumable transfer contract
→ Unified Execution Story
→ Time Travel foundation
→ Windows CP13→CP14 update replay and data comparison
→ Full release matrix and Complete Delivery
```

Windows replay remains an exit gate for Checkpoint 14, not a future milestone substitute.

---

## 7. Final disposition

**Foundation 1 is implemented and source-verified.** It preserves Checkpoint 13, establishes the adoption and trusted-update substrate, and leaves all unverified platform and later-workstream claims explicitly open.
