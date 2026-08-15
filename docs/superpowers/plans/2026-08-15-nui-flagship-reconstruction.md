# NUI Flagship Reconstruction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconstruct Nolane Agent into the NUI flagship “Proofborne Instrument” visual system while preserving verified semantics, routes, evidence truth, accessibility contracts and deterministic `ui-v3 -> ui-dist` output.

**Architecture:** Keep controller/API contracts stable. Introduce a focused flagship visual-system stylesheet plus semantic token refinements and only the markup hooks required for shell/home/mission/workspace hierarchy. Migrate each major surface behind TDD contracts, rebuild `ui-dist`, then use the existing Chromium/Windows evidence workflows for rendered critique and exact-SHA promotion.

**Tech Stack:** Vanilla ES modules, HTML string renderers, CSS custom properties, Node 22 test runner, Electron/Chromium runtime evidence, GitHub Actions.

## Global Constraints

- Baseline: `39c05216a553b577c53060716387a2a6919f0a03`.
- NUI evidence class: `ARTIFACT_WORK`.
- `ui-v3` is source; `ui-dist` is deterministic generated output and is never hand-edited.
- No fake capabilities, evidence, provider state, metrics, screen-reader PASS or Windows-8GB empirical claims.
- Preserve route/action reachability, keyboard access, settings persistence and evidence semantics.
- Keep 980px as the real early-collapse breakpoint; existing 900px quality inventory compatibility must not regress.
- Full local suite has one environment-only DNS failure in `browser-runtime-pool.test.mjs`; exact-head GitHub CI remains final full-suite authority.

---

### Task 1: Flagship visual-system contract

**Files:** Create `tests/ui-v3-flagship-reconstruction.test.mjs`, create `ui-v3/styles/flagship/proofborne-instrument.css`, modify `ui-v3/styles/index.css` and `ui-v3/styles/tokens/semantic.css`.

- [ ] Write a failing Node test that requires the new stylesheet import after page styles but before accessibility/responsive policy, requires `--instrument-rule`, `--instrument-margin`, `--instrument-plate`, `--instrument-trace`, and rejects decorative global glass/gradient defaults in the flagship layer.
- [ ] Run `node --test tests/ui-v3-flagship-reconstruction.test.mjs` and confirm RED.
- [ ] Add semantic instrument tokens and the dedicated stylesheet with baseline shell/surface material roles.
- [ ] Run focused test and `npm run validate:ui-tokens`; confirm GREEN.
- [ ] Commit `feat(ui): establish Proofborne Instrument visual system`.

### Task 2: Shell + command band + context dock

**Files:** Modify flagship stylesheet and only missing semantic hooks in `ui-v3/shell/app-shell.mjs`, `global-rail.mjs`, `session-sidebar.mjs`. Tests: flagship test, `ui-v3-shell.test.mjs`, `ui-v3-session-sidebar.test.mjs`.

- [ ] RED: require trace-notch active rail, flatter context dock, calibrated command band and no transform/glow-driven active navigation emphasis in the flagship layer.
- [ ] Implement while preserving landmarks, route list and runtime truth DOM.
- [ ] Run focused shell/accessibility tests and confirm GREEN.
- [ ] Commit `feat(ui): reconstruct flagship shell as an instrument band`.

### Task 3: Home + Mission launch/Proofline continuity

**Files:** Flagship stylesheet; markup only if required in `home-view.mjs` and `activity-view.mjs`. Tests: flagship test, `ui-v3-home.test.mjs`, `nui-proofline-mission-cockpit.test.mjs`.

- [ ] RED: Home command aperture, attached runtime/trust band, command-like capabilities, lineage-style recent missions, Mission ruled field and recovery consequence plate.
- [ ] Implement using existing real state only.
- [ ] Run focused tests and `npm run build:ui-v3`.
- [ ] Commit `feat(ui): turn Home and Mission into one proof-bearing workflow`.

### Task 4: Studio + Browser + Review

**Files:** Flagship stylesheet and page styles where clearer; markup only for missing real-state hooks in workroom/browser/review views.

- [ ] RED: mission context strip/flatter Studio panes, P0 Browser trust boundary band, intent→change→evidence→decision Review anatomy.
- [ ] Implement without new backend data.
- [ ] Run workroom/browser/review focused tests + build.
- [ ] Commit `feat(ui): extend Proofborne Instrument across work surfaces`.

### Task 5: Skills + Settings + Control Plane

- [ ] RED: capability provenance anatomy, quiet Settings consequence bar, Control Plane outline/calibration hierarchy.
- [ ] Implement while preserving progressive Settings/Skills performance fixes.
- [ ] Run focused tests, UI token and quality audits.
- [ ] Commit `feat(ui): finish flagship information surfaces`.

### Task 6: Structural responsive reconstruction

- [ ] RED contract for ≤980 shell collapse and ≤640 Studio/Skills/Settings structural behavior.
- [ ] Implement without reintroducing deprecated 900px collapse behavior.
- [ ] Run responsive + quality tests.
- [ ] Commit `feat(ui): recompose flagship layout under compact pressure`.

### Task 7: Deterministic build + static verification

- [ ] Run flagship focused tests.
- [ ] Run `npm run build:ui-v3`.
- [ ] Run `npm run audit:ui-quality`, `npm run validate:ui-tokens`, release/freshness checks.
- [ ] Confirm `ui-dist` matches generator output and no unrelated files changed.
- [ ] Commit generated distribution/evidence artifacts.

### Task 8: Runtime critique cycle 1 — silhouette/hierarchy

- [ ] Capture Home, Mission, Studio, Browser, Skills, Settings, Control Plane at desktop + compact and Home nocturne.
- [ ] Downscale/grayscale review artifacts and record first/second/third attention target per screen.
- [ ] Apply smallest causal corrections, rebuild, re-render and document before/after.
- [ ] Commit `fix(ui): close flagship hierarchy critique cycle`.

### Task 9: Runtime critique cycle 2 — taste/residue

- [ ] Audit type metrics, border/radius saturation, optical alignment, native chrome, density modulation, dark parity and signature saturation.
- [ ] Apply causal corrections only; no decoration stacking.
- [ ] Re-render representative states and document second critique→correction loop.
- [ ] Commit `fix(ui): close flagship taste and residue critique cycle`.

### Task 10: Exact-SHA GitHub verification, merge and delivery

- [ ] Push complete branch and open draft PR to `codex/external-gate-evidence`.
- [ ] Require fresh exact-head CI, UI visual, UI performance and external-gate workflows; preserve external unknowns.
- [ ] Repair any runtime finding at its earliest causal task.
- [ ] Merge only with expected-head protection when applicable families are GREEN.
- [ ] Run post-merge CI/external gates on final default SHA.
- [ ] Package exact final SHA as COMPLETE ZIP + verification manifest/receipts; verify ZIP + SHA-256; upload copy to ChatGPT Library.
