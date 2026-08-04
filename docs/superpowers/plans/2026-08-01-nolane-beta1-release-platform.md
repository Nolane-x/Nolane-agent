# Nolane Agent 5.0.0-beta.1 Release Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the bundled NolaneNative runtime/archive from Nolane Agent, replace the remaining accepted behavior contracts with Nolane-native services, and add a reproducible GitHub-to-Windows NSIS installer and authenticated update-notification pipeline.

**Architecture:** Production packages contain only Nolane-native runtime code. Historical NolaneNative provenance remains as non-executable documentation and a retirement receipt, not as an archive, importable module, runtime route, or packaged asset. GitHub Actions builds on Windows, runs the full release matrix, generates NSIS and portable artifacts, signs a Nolane Ed25519 release manifest, publishes GitHub Release assets/update metadata, creates build attestations, and exposes a safe update channel to the Electron main process. Electron uses a dual trust model: electron-updater handles NSIS transport/install, while Nolane verifies an independently signed manifest and exact version/hash policy before notifying the user or allowing installation.

**Tech Stack:** Node.js 22.12+, Electron 43.2.0, electron-builder 26.15.3, electron-updater 6.8.9, NSIS, GitHub Actions, GitHub Releases, GitHub artifact attestations, Ed25519, existing HTML/CSS/ESM UI, Node test runner.

## Global Constraints

- Do not copy, relabel, or claim ownership of NolaneNative/Nous Research source code.
- Do not include `vendor/nolane_native-agent`, the NolaneNative ZIP, NolaneNative runtime modules, or NolaneNative API/UI routes in production packages.
- Preserve required MIT attribution and historical provenance in `THIRD_PARTY_NOTICES.md` and immutable retirement evidence.
- Do not store update signing private keys in the repository or release artifacts.
- Tag releases must fail closed when the Nolane update signing key is unavailable.
- Unsigned development installers may be built for CI artifacts, but production releases must report whether Authenticode signing was applied.
- Update checks may run automatically; installation requires explicit user action unless an administrator policy opts in.
- Do not weaken the existing 160-static-import microkernel budget.
- Do not turn GitHub metadata, test fixtures, or workflow syntax into a capability claim.
- Every implementation task follows TDD and ends with direct verification.

---

## Task 1: Nolane runtime purity inventory and fail-closed package policy

**Files:**
- Create: `src/nolane-native/nolane-runtime-purity-service.mjs`
- Create: `scripts/verify-nolane-runtime-purity.mjs`
- Create: `tests/nolane-runtime-purity.test.mjs`
- Modify: `scripts/build-electron.mjs`
- Modify: `scripts/package-release-artifacts.mjs`
- Modify: `src/app.mjs`
- Delete: `vendor/nolane_native-agent/nolane_native-agent-main.zip`
- Delete: runtime-only `src/nolane_native/*.mjs` modules after replacement verification

**Interfaces:**
- Produces: `verifyNolaneRuntimePurity({ rootDirectory }): Promise<RetirementReceipt>`
- Receipt fields: `archiveAbsent`, `productionImports`, `packagedPaths`, `acceptedContracts`, `replacementCoverage`, `attributionPreserved`, `receiptSha256`.

- [ ] Write failing tests that assert the NolaneNative archive, runtime services, HTTP routes, UI routes, and Electron package paths are absent.
- [ ] Run tests and confirm failure against alpha.5.
- [ ] Implement the retirement verifier and package denylist.
- [ ] Remove the archive and runtime-only modules after all accepted contracts map to Nolane-native replacements.
- [ ] Run retirement tests and package staging tests.
- [ ] Commit `feat(runtime): retire bundled NolaneNative runtime and archive`.

## Task 2: Electron-builder NSIS packaging

**Files:**
- Create: `electron-builder.config.cjs`
- Create: `build/installer.nsh`
- Create: `scripts/build-electron-installer.mjs`
- Create: `scripts/verify-electron-installer-config.mjs`
- Create: `tests/electron-installer-config.test.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `npm run build:electron:installer` and artifacts under `release/installer/`.
- Expected artifacts: `NolaneAgent-Setup-<version>-x64.exe`, blockmap, `latest*.yml`, portable ZIP.

- [ ] Write failing tests for stable appId/GUID, NSIS target, differential package, user-data preservation, artifact naming, updater compatibility, and NolaneNative exclusions.
- [ ] Add exact dependencies: Electron 43.2.0, electron-builder 26.15.3, electron-updater 6.8.9.
- [ ] Implement NSIS config with assisted per-user install, shortcuts, upgrade preservation, and no app-data deletion.
- [ ] Add config verifier that rejects accidental NolaneNative inclusion and mutable appId/GUID changes.
- [ ] Run tests and config verifier.
- [ ] Commit `build(electron): add reproducible NSIS installer`.

## Task 3: Dual-trust Electron update controller

**Files:**
- Create: `desktop/update-controller.cjs`
- Create: `desktop/update-policy.cjs`
- Create: `tests/electron-update-controller.test.mjs`
- Modify: `desktop/main.cjs`
- Modify: `desktop/preload.cjs`
- Modify: `src/update/update-service.mjs`

**Interfaces:**
- IPC: `nolane:update-status`, `nolane:check-update`, `nolane:download-update`, `nolane:install-update`, `nolane:set-update-channel`.
- Status states: `disabled`, `idle`, `checking`, `available`, `downloading`, `downloaded`, `up-to-date`, `error`.

- [ ] Write failing tests using a fake updater transport and signed Nolane manifests.
- [ ] Require Nolane manifest verification before accepting an updater version.
- [ ] Bind progress/error/downloaded events to an immutable status snapshot.
- [ ] Require trusted IPC sender and explicit install action.
- [ ] Add bounded startup scheduling that skips unpackaged/dev sessions and first-run installer locks.
- [ ] Run controller, preload, and Electron shell tests.
- [ ] Commit `feat(update): add signed Electron update controller`.

## Task 4: Workspace update UI and notifications

**Files:**
- Create: `ui-v3/core/update-client.mjs`
- Create: `ui-v3/components/update-banner.mjs`
- Create: `ui-v3/styles/components/update-banner.css`
- Create: `tests/ui-v3-update-banner.test.mjs`
- Modify: `ui-v3/app.mjs`
- Modify: `ui-v3/index.html`
- Modify: `ui-v3/styles.css`

**Interfaces:**
- UI actions: Check, Download, Restart and install, Later, View release notes.
- Must show exact version, channel, download progress, signature status, and restart impact.

- [ ] Write failing DOM/source tests for all updater states and keyboard semantics.
- [ ] Implement event-driven banner with no fake percentage.
- [ ] Add system notification only when app is unfocused and update is downloaded.
- [ ] Preserve user work by querying mission/checkpoint state before restart.
- [ ] Run UI accessibility and reduced-motion tests.
- [ ] Commit `feat(ui): surface trusted update notifications`.

## Task 5: GitHub CI and release automation

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/release.yml`
- Create: `.github/dependabot.yml`
- Create: `scripts/validate-github-release-workflow.mjs`
- Create: `tests/github-release-workflow.test.mjs`
- Create: `docs/RELEASING.md`

**Interfaces:**
- CI triggers: pull request and push.
- Release trigger: `v*` tag and manual dispatch.
- Required secret: `NOLANE_UPDATE_PRIVATE_KEY_B64`.
- Optional Authenticode secrets: `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD`.

- [ ] Write failing workflow tests for least-privilege permissions, pinned action SHAs/major versions, tag/version match, full matrix prerequisite, Windows installer build, manifest signing, checksum generation, release upload, attestation, and failure on missing signing key.
- [ ] Implement CI with Node/Windows validation and uploaded logs.
- [ ] Implement release workflow with Windows build, GitHub Release creation, update metadata, Nolane signed manifest, SBOM/checksum, and artifact attestation.
- [ ] Add concurrency so the same tag cannot publish twice.
- [ ] Add documented repository setup and secret-generation commands.
- [ ] Run workflow validator and tests.
- [ ] Commit `ci(release): publish attested Windows installers from tags`.

## Task 6: Release manifest and GitHub channel policy

**Files:**
- Create: `src/update/github-release-policy.mjs`
- Create: `scripts/create-github-update-manifest.mjs`
- Create: `tests/github-update-manifest.test.mjs`
- Modify: `scripts/update-release-tools.mjs`
- Modify: `config/update.example.json`

**Interfaces:**
- Channels: alpha, beta, stable, nightly.
- Manifest binds repository, tag, commit SHA, installer name, installer SHA-256/bytes, latest.yml SHA-256, minimum launcher, release notes URL, and Ed25519 signature.

- [ ] Write failing tests for tag/version/channel mapping and repository allowlist.
- [ ] Extend signed manifest schema to v2 while retaining v1 verification compatibility.
- [ ] Reject mutable/draft release URLs, wrong repository, mismatched version, and unexpected installer names.
- [ ] Run update-service and release-tooling tests.
- [ ] Commit `feat(update): bind signed manifests to GitHub releases`.

## Task 7: Recovery, rollback and migration-safe update lifecycle

**Files:**
- Create: `desktop/update-recovery.cjs`
- Create: `tests/electron-update-recovery.test.mjs`
- Modify: `desktop/main.cjs`
- Modify: `desktop/runtime-supervisor.cjs`
- Modify: `desktop/legacy-migration.cjs`

**Interfaces:**
- Records `last-known-good`, pending version, start timestamp, health confirmation, and rollback guidance.
- Never deletes mission data or credentials.

- [ ] Write failing tests for crash-before-health, stale pending marker, user-data preservation, and retry suppression.
- [ ] Implement health confirmation after runtime and UI readiness.
- [ ] Preserve last-known-good metadata and expose recovery instructions when automatic rollback is unavailable.
- [ ] Run supervisor and migration tests.
- [ ] Commit `feat(update): add health-gated update recovery`.

## Task 8: Beta.1 acceptance ledger, docs and release matrix

**Files:**
- Modify: `requirements/nolane-requirement-definitions.mjs`
- Modify: `scripts/generate-nolane-program.mjs`
- Modify: `src/release/full-release-matrix.mjs`
- Create: `docs/NOLANE-AGENT-5.0.0-BETA.1-STATUS.md`
- Create: `docs/RELEASE-5.0.0-beta.1.md`
- Create: `docs/LIMITATIONS-5.0.0-beta.1.md`
- Create: `tests/nolane-beta1-release-docs.test.mjs`

**Interfaces:**
- New gates: Nolane runtime purity, NSIS config, update controller, update UI, GitHub workflow, GitHub signed manifest, update recovery.
- `NOL-NOLANE_NATIVE-040` may be verified only when archive/runtime/package scans pass.
- GitHub-hosted installer execution and Authenticode trust remain external until a real workflow run is attached.

- [ ] Write failing ledger and matrix tests.
- [ ] Add exact source/test evidence for completed beta.1 requirements.
- [ ] Keep Windows/provider/accessibility runtime certifications open where not executed.
- [ ] Regenerate gaps, manifests, evidence hashes, and release docs.
- [ ] Run full Node suite, SDK lanes, ForgeOS validation, and full release matrix.
- [ ] Package source, installer configuration, portable Windows build, VSIX, evidence, checksums, and change-set.
- [ ] Commit `release: prepare Nolane Agent 5.0.0-beta.1`.
