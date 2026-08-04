# Forge Studio 0.5 Electron Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans and superpowers:test-driven-development. Steps use checkbox syntax for tracking.

**Goal:** Ship a secure Electron desktop build that resumes failed missions and exposes a useful live execution trace.

**Architecture:** Keep ForgeOS and the existing agent runtime intact. Host the runtime in an Electron utility process, expose a narrow preload API, and let the sandboxed renderer consume the authenticated loopback API.

**Tech Stack:** Electron, Node.js 22+, JavaScript modules, SQLite, ForgeOS, Go native PTY/Credential helpers.

## Global Constraints

- Never run the agent runtime in the renderer.
- Never enable renderer Node integration.
- Never expose generic IPC send/invoke primitives.
- Never lose a user follow-up or recreate a mission solely to recover it.
- Never display raw secrets, raw environment data, or unrestricted tool arguments.
- Keep default eager UI assets below 100,000 bytes.

---

### Task 1: Failed verification recovery
- [x] Add a failing test that leaves a task in review after verification failure.
- [x] Transition failed verification to failed with structured metadata.
- [x] Recover review-stuck tasks during retry.
- [x] Verify focused and full tests.

### Task 2: Follow-up continuation
- [x] Add a failing test that sends a message after mission failure.
- [x] Recover and relaunch automatically from the saved checkpoint.
- [x] Expose structured failure state in snapshots.

### Task 3: Live trace projection
- [x] Add tool started/completed event tests.
- [x] Project safe target, provider, duration, exit code, bytes, and usage.
- [x] Render exact failure and recovery activities.

### Task 4: Token truthfulness
- [x] Add a CLI usage regression test.
- [x] Report bounded estimated tokens and label estimates in UI.

### Task 5: Electron security policy
- [ ] Write tests for loopback origin, window preferences, navigation, and external URL policy.
- [ ] Implement the policy as a dependency-free CommonJS module.

### Task 6: Runtime supervisor
- [ ] Write tests for startup handoff, bounded restart, crash reporting, and shutdown.
- [ ] Implement a utility-process supervisor with injected process factory.

### Task 7: Main process and preload
- [ ] Add static contract tests for the preload API and Electron lifecycle.
- [ ] Implement secure main/preload scripts and native folder selection.
- [ ] Wire folder selection into the existing project dialog.

### Task 8: Electron release staging
- [ ] Add package-closure tests that exclude user data and development-only files.
- [ ] Implement a pinned Electron Windows staging script and manifest generation.
- [ ] Build native helpers and stage `resources/app`.

### Task 9: Documentation and version
- [ ] Update product version and user guide.
- [ ] Document the recovery semantics and Electron security boundary.
- [ ] Regenerate project manifest.

### Task 10: Release verification
- [ ] Run all Studio tests.
- [ ] Run all ForgeOS tests.
- [ ] Run native Go tests and vet.
- [ ] Smoke-test source and staged package where supported.
- [ ] Verify hashes, archive integrity, and executable formats.
