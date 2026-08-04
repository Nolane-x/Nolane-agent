# Forensic Recovery Checkpoint 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans with test-driven development and verification-before-completion.

**Goal:** Complete every source-local UI v3 master-plan item, reconstruct assertion-level evidence for UI/Audit requirements, make UI v3 the receipt-verified beta default, and add a fail-closed Checkpoint 2 release gate without unlocking NolaneNative or external certification claims.

**Architecture:** UI v3 remains a native ESM/DOM renderer split into Workspace and Control Plane. New lifecycle modules are lazy and disposable, review decisions are content-addressed, and release selection requires a build manifest plus matching source-release receipt. Forensics treats assertion bindings, UI source completion, upstream source custody, and external certifications as separate truth planes.

**Tech Stack:** Node.js 22 ESM, Electron renderer assets, native DOM/CSS, SHA-256 receipts, Node test runner, existing Nolane release matrix.

## Global Constraints

- Canonical NolaneNative source is unavailable until the 67,431,284-byte archive with SHA-256 `1ac5fcb20630d6556f6169cb836dda73298b2371f7c0a6ed23bcc5d6eaf41cd9` is supplied.
- `completeParityClaimAllowed` and `comparativeSuperiorityClaimAllowed` remain `false`.
- Windows 11 8 GB, NVDA/Narrator, high-contrast, performance, screenshot, and provider-real claims remain external.
- UI v2 remains an explicit recovery override.
- No requirement becomes assertion-certified from file existence alone.
- Matrix verification is read-only; generators write only before the release commit.

---

### Task 1: Assertion Evidence Binding

**Files:**
- Create: `src/forensics/assertion-evidence-binding.mjs`
- Create: `scripts/generate-assertion-evidence-bindings.mjs`
- Create: `tests/forensic-assertion-evidence-binding.test.mjs`
- Create: `tests/forensic-assertion-evidence-generator.test.mjs`

**Deliverable:** Content-addressed requirement bindings with production entrypoint, exact test file, named tests, positive assertions, negative assertions, and explicit unbound coverage.

### Task 2: Mission, Project, Risk, and Performance Foundations

**Files:**
- Create project switcher and session projection modules.
- Create incremental mission header, status, timeline, activity, and composer modules.
- Create fail-closed approval, permission, and recovery cards.
- Create performance schema and pending external baseline.

**Deliverable:** Stable mission lifecycle and no synthetic Windows performance evidence.

### Task 3: Artifact Dock and Review & Ship

**Files:**
- Create lazy artifact registry and plan/tests/preview renderers.
- Create change navigator, virtualized diff viewport, verification summary, and diff worker.
- Modify review model to bind decisions to content SHA-256 and evidence IDs.

**Deliverable:** Stale review decisions are rejected and hidden renderers are torn down.

### Task 4: Workroom and Control Plane Separation

**Files:**
- Create lazy Workroom controller.
- Create dedicated autonomy, extensions, and release domains.
- Create overview, graph, and search workers.
- Add safe route navigation with error isolation.

**Deliverable:** Workroom contains development surfaces only; administrative domains remain in Control Plane.

### Task 5: Motion, Visibility, Accessibility, and Visual State Gates

**Files:**
- Create `ui-v3/styles/motion.css`.
- Create scheduler and visibility policy.
- Create accessibility audit, visual-state manifest, and UI release verifier.

**Deliverable:** Source-local semantics pass while screen-reader, screenshots, and Windows performance stay external.

### Task 6: Receipt-Verified UI v3 Default

**Files:**
- Modify `scripts/build-ui-v3.mjs`.
- Modify `src/ui/ui-root-resolver.mjs`.
- Modify `src/app.mjs`.

**Deliverable:** UI v3 is the beta default only when `manifest.json` and `source-release.json` match; production fails closed on stale receipts and v2 remains an explicit recovery override.

### Task 7: Checkpoint 2 and Matrix Gate

**Files:**
- Create `src/forensics/recovery-checkpoint-2.mjs`.
- Create `scripts/verify-forensic-recovery-checkpoint-2.mjs`.
- Create `tests/forensic-recovery-checkpoint-2.test.mjs`.
- Modify release matrix and gate-count tests from 148 to 149.

**Deliverable:** Matrix requires source-local UI completion, assertion evidence coverage, unresolved NolaneNative truth, and protected non-claims.

### Task 8: Regeneration, Full Regression, Clean-Room Release

**Commands:**
- Regenerate program registry, native catalog, master ledger, remaining gaps, UI receipts, symbol inventory, truth ledger, evidence audit, assertion baseline, source custody, and checkpoint docs.
- Run all Node test files, isolated packaging tests, and serial tests.
- Run Full Release Matrix 149/149 from a clean immutable commit.
- Package source, patch, change set, evidence, reports, manifest, and checksums.

**Acceptance:** No source-local UI master-plan gap remains; no external claim is synthesized; Git tree is clean; every delivery artifact passes SHA-256 and ZIP integrity checks.
