# NUI Main Integration Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce one coherent, verified Nolane Agent integration line that preserves the completed provider/evidence hardening, updates the NUI provenance to the current canonical revision, completes the Proofline Mission Cockpit runtime evidence loop, regenerates all derived UI/evidence artifacts through official generators, and then fast-forwards a new `main` branch to that verified checkpoint.

**Architecture:** Repair the stacked PR #6/#7 history without hand-editing receipts: restore provider-real files from `codex/external-gate-evidence`, keep the NUI host sidecar as advisory cognition injected through `ContextBuilder`, and keep host sandbox/approval/tool authority unchanged. Extend the existing Chromium visual-evidence harness with a deterministic source-runtime Proofline mission fixture so the selected flagship architecture is rendered, Axe-checked and captured at desktop/compact widths before any completion claim.

**Tech Stack:** Node.js 24, ESM, Electron source contracts, Playwright + Axe, GitHub Actions, deterministic `ui-v3 → ui-dist` build, Nolane evidence/acceptance generators, Nolane UI Intelligence v10.

## Global Constraints

- NUI canonical source is `Nolane-x/Nolane-UI-Intelligence`; current reviewed revision is `46780cdd58e41bea8338b2d27269d339c95e28e7`.
- `719981b7a2cf0e8406672d20ce1840e7a26ef5b8..46780cdd58e41bea8338b2d27269d339c95e28e7` has zero net file changes, so provenance may advance without changing canonical cognition content.
- NUI remains advisory cognition. Nolane host sandbox, approvals, permissions, browser/network/MCP/filesystem authority remain final.
- Generator ceiling remains `CRITIQUED`; generator self-certification is forbidden; missing independent evidence stays `UNKNOWN`.
- Flagship UI requires three materially divergent directions, generic-transfer resistance, structural responsive evidence and at least two closed critique/correction cycles.
- Never hand-edit generated hashes or relabel an external gate to make CI green.
- Preserve provider-real dogfood candidate semantics: hash/metadata-only, `candidate_unverified`, `external_gate`, independent receipt required.
- `ui-v3` is editable source; `ui-dist` must be generated only by `npm run build:ui-v3`.
- Do not create an Electron release/installer as part of this checkpoint.

---

### Task 1: Restore stacked provider/evidence integrity

**Files:**
- Restore from `codex/external-gate-evidence`: `.github/workflows/provider-real-dogfood-self-hosted.yml`
- Restore: `docs/provider-real-dogfood-runbook.md`
- Restore: `docs/superpowers/plans/2026-08-14-provider-real-dogfood-self-hosted.md`
- Restore: `docs/superpowers/specs/2026-08-14-provider-real-dogfood-self-hosted-design.md`
- Restore: `scripts/validate-provider-dogfood-candidate.mjs`
- Restore: `src/providers/provider-dogfood-candidate-runner.mjs`
- Restore: `tests/provider-dogfood-candidate-runner.test.mjs`
- Restore: `tests/provider-dogfood-self-hosted-workflow.test.mjs`

**Interfaces:**
- Consumes: canonical provider profile and runner already present on PR #6.
- Produces: the same fail-closed provider candidate/evidence contract on the integrated branch.

- [ ] **Step 1:** Restore the exact blobs from PR #6; do not rewrite them manually.
- [ ] **Step 2:** Run provider dogfood unit/workflow tests and verify candidate fields remain content-free and non-self-certifying.
- [ ] **Step 3:** Confirm the integrated diff no longer deletes provider-real files relative to PR #6.

### Task 2: Advance NUI provenance without changing authority

**Files:**
- Modify: `config/nui-integration.v10.json`
- Modify: `src/ui-intelligence/nui-host-sidecar.mjs`
- Modify: `tests/nui-host-sidecar.test.mjs`
- Modify: `tests/nui-context-builder.test.mjs`
- Modify: `tests/nui-proofline-mission-cockpit.test.mjs`
- Modify: `docs/superpowers/specs/2026-08-14-nui-v10-host-sidecar-design.md`
- Modify: `docs/ui/nui-flagship-visual-synthesis-v1.md`

**Interfaces:**
- Consumes: current canonical NUI revision with zero net tree delta from the previous reviewed pin.
- Produces: envelope provenance bound to the exact current revision while retaining `generic-cli`, canonical skill/graph paths, host authority and generator ceiling.

- [ ] **Step 1:** Update only the reviewed revision/provenance references from `719981...` to `46780...`.
- [ ] **Step 2:** Run NUI sidecar/context/Proofline source tests.
- [ ] **Step 3:** Reject any change that expands host capabilities or allows generator verification.

### Task 3: Add real runtime evidence for the Proofline Mission Cockpit

**Files:**
- Modify: `scripts/capture-ui-runtime-visual.mjs`
- Modify: `.github/workflows/ui-runtime-visual.yml`
- Test: `tests/ui-runtime-visual-workflow.test.mjs`
- Test: `tests/nui-proofline-mission-cockpit.test.mjs`

**Interfaces:**
- Consumes: `/api/projects`, `/api/missions/plan`, `/api/time-travel/checkpoints`, `/missions?id=<missionId>` and existing activity renderer.
- Produces: `mission-proofline` desktop and compact runtime captures with a selected deterministic mission, Axe evidence, responsive overflow checks and screenshot hashes.

- [ ] **Step 1:** Write failing assertions that the visual workflow requests Proofline captures and that the capture registry contains desktop + compact Proofline states.
- [ ] **Step 2:** Add a deterministic fixture preparation path that creates a temporary project using the runner workspace, plans a provider-independent mission from an explicit plan, creates a checkpoint when available, then navigates to `/missions?id=<missionId>`.
- [ ] **Step 3:** Capture `mission-proofline` at 1440×1000 and `mission-proofline-compact` at 820×1000; require `.mission-spotlight`, `.execution-story`, `.time-travel` and `.activity-filament` to be structurally present where applicable.
- [ ] **Step 4:** Run Axe serious/critical checks, horizontal-overflow checks, keyboard focus checks for recovery controls, and screenshot capture.
- [ ] **Step 5:** Keep independent screen-reader evidence `UNKNOWN`; Chromium/Axe cannot promote it to PASS.

### Task 4: Regenerate distribution and evidence through official generators

**Files:**
- Generated: `ui-dist/**`
- Generated evidence/ledger files touched by repository generators only.

**Interfaces:**
- Consumes: repaired source tree.
- Produces: deterministic UI manifest/source-release and fresh acceptance/conformance/evidence receipts.

- [ ] **Step 1:** Run `npm ci --ignore-scripts` on GitHub runner.
- [ ] **Step 2:** Run `npm run build:ui-v3` and require `git diff --exit-code -- ui-dist` to be clean after generated artifacts are committed.
- [ ] **Step 3:** Run the repository’s assertion-binding/conformance/master-ledger generators in dependency order; never edit receipt hashes directly.
- [ ] **Step 4:** Run `npm run audit:evidence-freshness`, `npm run verify:ui-v3-release`, NUI tests and provider dogfood tests.
- [ ] **Step 5:** Commit only source, tests, exact restored provider files and generated artifacts produced by those commands.

### Task 5: Close NUI critique cycle 2 with observed evidence

**Files:**
- Modify: `docs/ui/nui-flagship-visual-synthesis-v1.md`
- If observations require corrections: `ui-v3/styles/pages/mission-proofline.css` and narrowly related source/tests.

**Interfaces:**
- Consumes: GitHub Actions runtime visual receipt and screenshots from Task 3.
- Produces: evidence-bound critique findings/corrections; no self-issued `VERIFIED` claim.

- [ ] **Step 1:** Inspect the actual desktop/compact screenshots and receipt from the GitHub visual gate.
- [ ] **Step 2:** Record observed hierarchy, Proofline readability, recovery behavior, receipt discoverability, overflow/focus, empty-state and nocturne compatibility findings.
- [ ] **Step 3:** If a material issue exists, patch source, regenerate `ui-dist`, rerun visual evidence and record the re-observed correction.
- [ ] **Step 4:** Mark critique cycle 2 closed only after correction is re-observed. Keep release verification independent.

### Task 6: Promote the verified integration line to `main`

**Files:**
- Git branch refs only after all previous tasks pass.

**Interfaces:**
- Consumes: a single verified repair-branch commit.
- Produces: `main` pointing exactly to that commit; normal main CI then independently re-runs source and visual contracts.

- [ ] **Step 1:** Verify repair branch CI/evidence/visual workflows are green for the exact head SHA.
- [ ] **Step 2:** Create `main` at that SHA (the repository currently has no `main` branch) or fast-forward it if another actor creates it first.
- [ ] **Step 3:** Verify main-triggered CI runs on the same tree; do not rewrite history or force-push.
- [ ] **Step 4:** Leave external provider credentials, hardware-specific evidence and independent screen-reader verification explicitly external/unknown unless real receipts exist.
