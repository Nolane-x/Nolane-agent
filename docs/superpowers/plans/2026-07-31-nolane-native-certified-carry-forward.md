# NolaneNative Certified Carry-Forward Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Certify Forge Studio 3.1.0 against the unchanged NolaneNative optional pack using prior content-addressed release evidence when the archive is not locally installed.

**Architecture:** Add a dedicated carry-forward verifier and immutable certificate. Prefer direct archive verification; otherwise require exact runtime-file and evidence continuity. Teach packaging to reference, rather than republish, the unchanged optional pack.

**Tech Stack:** Node.js ESM, node:test, canonical SHA-256 receipts, existing release matrix and ZIP packager.

## Global Constraints

- Preserve NolaneNative archive SHA-256 `1ac5fcb20630d6556f6169cb836dda73298b2371f7c0a6ed23bcc5d6eaf41cd9` and byte count `67431284`.
- Preserve upstream commit `846b14ab01a84483d2c3dd429579173040474585`.
- Direct archive verification remains the preferred path.
- Carry-forward must fail closed on any protected-file or manifest drift.
- Core artifacts never embed `nolane_native-agent-main.zip`.

---

### Task 1: Carry-forward certificate verifier

**Files:**
- Create: `tests/nolane_native-carry-forward-certification.test.mjs`
- Create: `src/nolane_native/nolane_native-carry-forward-certification.mjs`
- Create: `vendor/nolane_native-agent/carry-forward-certification.json`

- [ ] Write failing tests for valid evidence and tampering.
- [ ] Run the test and confirm module-not-found failure.
- [ ] Implement canonical receipt and protected-file verification.
- [ ] Run the focused test to GREEN.
- [ ] Commit.

### Task 2: Verification fallback

**Files:**
- Modify: `scripts/verify-nolane_native-vendor.mjs`
- Modify: `tests/nolane_native-optional-pack.test.mjs`

- [ ] Write a failing test proving direct verification is preferred and missing-pack fallback is explicit.
- [ ] Implement `direct-archive` and `certified-carry-forward` reports.
- [ ] Run focused tests to GREEN.
- [ ] Commit.

### Task 3: Release artifact reuse

**Files:**
- Modify: `src/release/release-artifacts.mjs`
- Modify: `tests/release-artifacts.test.mjs`
- Modify: `tests/nolane_native-release-integration.test.mjs`

- [ ] Write failing packaging tests for `reuse-certified`.
- [ ] Implement prior-pack reference without generating a fake current-version pack.
- [ ] Verify current-release archives and carry-forward evidence independently.
- [ ] Run focused tests to GREEN.
- [ ] Commit.

### Task 4: Release evidence and full certification

**Files:**
- Modify: `docs/RELEASE-3.1.0.md`
- Modify: `docs/LIMITATIONS-3.1.0.md`
- Modify: `project-manifest.json`

- [ ] Document exact reuse semantics and non-claims.
- [ ] Regenerate project manifest.
- [ ] Run NolaneNative, release-artifact, source-reconstruction, full Node, and 70-gate matrix verification.
- [ ] Commit generated release evidence only after all gates pass.
