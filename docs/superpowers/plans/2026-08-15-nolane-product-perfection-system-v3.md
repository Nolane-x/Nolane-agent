# Nolane Product Perfection System v3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Nolane Agent into a micro-detail-closed, evidence-driven, four-regime professional desktop AI workspace and complete the verified cross-platform release/update path without false certification claims.

**Architecture:** Keep the existing `ui-v3`/Electron/runtime capability architecture and add a product-perfection evidence layer around it. Implement systemic shared corrections before route-specific polish, then verify with real runtime captures, accessibility/performance evidence and platform receipts. `ui-dist` remains generated output only.

**Tech Stack:** Node.js ESM, vanilla modular UI v3, CSS token system, Electron, Node test runner, Playwright/Axe runtime workflows, GitHub Actions, Go native helpers, canonical acceptance/evidence generators.

## Global Constraints

- Preserve the approved `Everyday → Workspace → Studio → Expert` architecture as four distinct density/interaction regimes over one data/action model.
- Build success is not design success; high-ambition completion requires render → critique → correction → re-render.
- Never mark `UNKNOWN`, `BLOCKED`, provider-real, independent screen-reader, labelled Windows-8GB, signing/notarization or native update handoff `PASS` without corresponding evidence.
- Never hand-edit `ui-dist`; run `npm run build:ui-v3` and commit deterministic output only after source stabilizes.
- Keep `Proofborne Instrument` and `Evidence Spine / Trace` product-native; do not copy Codex trade dress.
- Fix unexplained layout defects by reproduction and measurement before CSS mutation.
- Every completed milestone must produce an exact-revision COMPLETE ZIP, integrity checksum and ChatGPT Library copy.

---

## File structure locked by this plan

### New product-perfection infrastructure

- `src/product-perfection/catalog.mjs` — parses and validates stable `PFX-*` audit IDs.
- `src/product-perfection/matrix-store.mjs` — normalizes audit observations and refuses unsupported PASS claims.
- `requirements/product-perfection-catalog.json` — machine-readable catalog derived from the approved Markdown catalog.
- `requirements/product-perfection-matrix.json` — generated current status/evidence matrix.
- `scripts/generate-product-perfection-catalog.mjs` — deterministic Markdown → JSON catalog generator.
- `scripts/generate-product-perfection-matrix.mjs` — deterministic matrix generator from declared evidence bindings.
- `scripts/verify-product-perfection-matrix.mjs` — checks unique IDs, status semantics, evidence references and exact revision binding.
- `tests/product-perfection-catalog.test.mjs` — catalog integrity tests.
- `tests/product-perfection-matrix.test.mjs` — matrix fail-closed tests.

### Runtime diagnostics

- `scripts/capture-ui-layout-diagnostics.mjs` — Playwright runtime geometry/scroll/focus diagnostics for selected states.
- `tests/ui-v3-project-layout-diagnostics.test.mjs` — workflow/contract tests for Projects anomaly reproduction.
- `artifacts/ui-layout-diagnostics/` — generated evidence only in evidence workflow/artifact, not ad-hoc source authority.

### Shared UI perfection layer

- `ui-v3/styles/perfection/micro-detail.css` — shared optical/state/residue refinements that cannot be expressed as tokens alone.
- `ui-v3/styles/perfection/density-regimes.css` — explicit Everyday/Workspace/Studio/Expert density rules.
- `ui-v3/styles/perfection/platform-residue.css` — intentional selection/caret/scrollbar/focus/platform residue behavior.
- `ui-v3/styles/index.css` — imports perfection layers in correct authority order before accessibility/responsive overrides.
- `ui-v3/styles/tokens/component.css` — state/density component aliases.
- `ui-v3/styles/tokens/semantic.css` — semantic state/text/evidence aliases where missing.
- `ui-v3/styles/accessibility-runtime.css` — final accessibility authority only.
- `ui-v3/styles/responsive.css` — final structural recomposition authority only.

### Route/source areas

- `ui-v3/shell/app-shell.mjs`
- `ui-v3/shell/global-rail.mjs`
- `ui-v3/shell/session-sidebar.mjs`
- `ui-v3/components/experience-switcher/experience-switcher.mjs`
- `ui-v3/views/onboarding/onboarding-view.mjs`
- `ui-v3/views/home/home-view.mjs`
- `ui-v3/views/projects/project-view.mjs`
- `ui-v3/views/mission/mission-view.mjs`
- `ui-v3/views/activity/activity-view.mjs`
- `ui-v3/views/review/review-view.mjs`
- `ui-v3/views/workroom/workroom-view.mjs`
- `ui-v3/views/browser/browser-view.mjs`
- `ui-v3/views/skills/skills-view.mjs`
- `ui-v3/views/settings/settings-view.mjs`
- `ui-v3/control-plane/*`
- corresponding `ui-v3/styles/pages/*.css` and existing tests.

---

### Task 1: Make the micro-detail catalog machine-verifiable

**Files:**
- Create: `src/product-perfection/catalog.mjs`
- Create: `src/product-perfection/matrix-store.mjs`
- Create: `scripts/generate-product-perfection-catalog.mjs`
- Create: `scripts/generate-product-perfection-matrix.mjs`
- Create: `scripts/verify-product-perfection-matrix.mjs`
- Create: `tests/product-perfection-catalog.test.mjs`
- Create: `tests/product-perfection-matrix.test.mjs`
- Generate: `requirements/product-perfection-catalog.json`
- Generate: `requirements/product-perfection-matrix.json`
- Modify: `package.json`

**Interfaces:**
- Produces `loadPerfectionCatalog(root) -> { ids: Map<string, item>, sections: Map<string, string[]> }`.
- Produces `normalizePerfectionObservation({id,status,evidence,revision,notes})`.
- Status enum: `PASS|FAIL|UNKNOWN|BLOCKED|NOT_APPLICABLE|DEFERRED_WITH_REASON`.
- `PASS` requires at least one evidence entry and a nonempty exact Git revision.

- [ ] **Step 1: Write RED catalog tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPerfectionCatalog } from '../src/product-perfection/catalog.mjs';

test('approved micro-detail catalog has unique stable PFX ids', async () => {
  const catalog = await loadPerfectionCatalog(process.cwd());
  assert.ok(catalog.ids.size > 200);
  assert.equal([...catalog.ids.keys()].every((id) => /^PFX-[A-Z]+-\d{3}$/.test(id)), true);
});
```

- [ ] **Step 2: Write RED fail-closed matrix tests**

```js
import { normalizePerfectionObservation } from '../src/product-perfection/matrix-store.mjs';

assert.throws(() => normalizePerfectionObservation({
  id: 'PFX-SHELL-001', status: 'PASS', evidence: [], revision: 'abc'
}), /PASS requires evidence/);

assert.throws(() => normalizePerfectionObservation({
  id: 'PFX-SHELL-001', status: 'PASS', evidence: [{ class: 'VIS', ref: 'run-1' }], revision: ''
}), /exact revision/);
```

- [ ] **Step 3: Run RED tests**

Run:

```bash
node --test tests/product-perfection-catalog.test.mjs tests/product-perfection-matrix.test.mjs
```

Expected: FAIL because modules do not exist.

- [ ] **Step 4: Implement catalog parser and observation normalizer**

Parser must read `docs/product-perfection/MICRO-DETAIL-CLOSURE-CATALOG.md`, extract every backticked `PFX-*` item, reject duplicates and preserve section headings. Matrix normalizer rejects unknown IDs and unsupported PASS.

- [ ] **Step 5: Add deterministic generators**

`generate-product-perfection-catalog.mjs` writes sorted JSON. `generate-product-perfection-matrix.mjs` initializes every ID as `UNKNOWN` unless explicit evidence bindings exist; it MUST NOT infer PASS from tests by filename.

- [ ] **Step 6: Add package scripts**

```json
"generate:product-perfection-catalog": "node scripts/generate-product-perfection-catalog.mjs",
"generate:product-perfection-matrix": "node scripts/generate-product-perfection-matrix.mjs",
"verify:product-perfection": "node scripts/verify-product-perfection-matrix.mjs"
```

- [ ] **Step 7: Verify GREEN**

```bash
npm run generate:product-perfection-catalog
npm run generate:product-perfection-matrix
npm run verify:product-perfection
node --test tests/product-perfection-catalog.test.mjs tests/product-perfection-matrix.test.mjs
```

- [ ] **Step 8: Commit**

```bash
git add src/product-perfection scripts/generate-product-perfection-*.mjs scripts/verify-product-perfection-matrix.mjs requirements/product-perfection-*.json tests/product-perfection-*.test.mjs package.json
git commit -m "feat(perfection): add evidence-bound micro-detail matrix"
```

---

### Task 2: Reproduce the Projects upper-whitespace anomaly before fixing it

**Files:**
- Create: `scripts/capture-ui-layout-diagnostics.mjs`
- Create: `tests/ui-v3-project-layout-diagnostics.test.mjs`
- Inspect/modify only after evidence: `ui-v3/views/projects/project-view.mjs`
- Inspect/modify only after evidence: `ui-v3/styles/pages/projects.css`
- Inspect: `ui-v3/core/view-state-bridge.mjs` or the actual current view-state persistence module discovered by existing `ui-v3-view-state-preserver` tests.

**Interfaces:**
- Diagnostic output JSON contains `viewport`, `route`, `freshContext`, `workspaceScrollTop`, `documentScrollTop`, `contentRect`, `firstRecordRect`, `shellRect`, `activeElement`, `restoredViewState`.

- [ ] **Step 1: Add RED workflow contract**

Test must assert diagnostics script captures Projects in both a fresh browser context and a restored-session context, at 1440 and 980 widths, and writes numeric bounding boxes + scroll values.

- [ ] **Step 2: Run test and confirm RED**

```bash
node --test tests/ui-v3-project-layout-diagnostics.test.mjs
```

- [ ] **Step 3: Implement Playwright diagnostic capture by adapting `scripts/capture-ui-runtime-visual.mjs`**

Use the same source runtime, fixture/bootstrap and browser version as the visual evidence workflow. Do not create a mock HTML page.

- [ ] **Step 4: Run diagnostics without source mutation**

Compare:

- fresh 1440;
- fresh 980;
- restored 1440;
- restored 980;
- zero projects and populated projects if fixtures support both.

- [ ] **Step 5: Classify one causal root**

Allowed outcomes include restored scroll state, route container min-height/grid placement, inherited transform, hidden preceding region retaining space, fixture state or another measured cause. Do not proceed with a CSS offset until measured evidence identifies the owner.

- [ ] **Step 6: Add RED regression for the identified cause**

Example if restored scroll is causal:

```js
assert.equal(restored.projects.workspaceScrollTop, 0, 'Projects route must not inherit another route scroll position');
```

Example if layout geometry is causal:

```js
assert.ok(firstRecordRect.top - contentRect.top < 180, 'Projects first actionable content must not begin in an unexplained empty band');
```

Use the measured threshold from the intended layout, not an arbitrary screenshot pixel guess.

- [ ] **Step 7: Implement the narrow causal correction**

Modify only the owning view-state/layout source. Preserve intended scroll restoration on routes where it is useful.

- [ ] **Step 8: Re-run diagnostics and visual capture**

```bash
node --test tests/ui-v3-project-layout-diagnostics.test.mjs tests/ui-v3-project-view.test.mjs tests/ui-v3-view-state-preserver.test.mjs
npm run build:ui-v3
```

Then run the existing GitHub runtime visual workflow on the candidate.

- [ ] **Step 9: Bind evidence**

Mark `PFX-PROJ-001` through the causally supported Projects items with exact diagnostic/visual evidence; leave unsupported items UNKNOWN.

- [ ] **Step 10: Commit**

```bash
git add scripts/capture-ui-layout-diagnostics.mjs tests/ui-v3-project-layout-diagnostics.test.mjs ui-v3/views/projects ui-v3/styles/pages/projects.css requirements/product-perfection-matrix.json
git commit -m "fix(ui): close Projects layout anomaly causally"
```

---

### Task 3: Build the shared micro-detail and density authority layer

**Files:**
- Create: `ui-v3/styles/perfection/micro-detail.css`
- Create: `ui-v3/styles/perfection/density-regimes.css`
- Create: `ui-v3/styles/perfection/platform-residue.css`
- Modify: `ui-v3/styles/index.css`
- Modify: `ui-v3/styles/tokens/component.css`
- Modify: `ui-v3/styles/tokens/semantic.css`
- Test: `tests/ui-v3-tokens.test.mjs`
- Test: `tests/ui-v3-flagship-reconstruction.test.mjs`
- Create: `tests/ui-v3-perfection-authority.test.mjs`

**Interfaces:**
- Root experience selector remains tied to existing experience state; use existing DOM attribute/class instead of inventing a parallel setting.
- Shared states use semantic variables, never raw page-specific hex values.

- [ ] **Step 1: Write RED authority tests**

Assert the three perfection files exist, are imported before `accessibility-runtime.css` and `responsive.css`, contain no raw colors outside token definitions, and define explicit regime selectors for all four experience levels.

- [ ] **Step 2: Run RED**

```bash
node --test tests/ui-v3-perfection-authority.test.mjs tests/ui-v3-tokens.test.mjs
```

- [ ] **Step 3: Implement density variables**

Expose semantic aliases for row height, section gap, control gap, control height and explanatory-copy density. Everyday values are comfortable, Workspace balanced, Studio compact, Expert dense-but-readable.

- [ ] **Step 4: Implement micro-detail base**

Own global optical rules for icon alignment, text truncation helpers, focus-safe overflow, semantic mono usage helpers and consequence plate/rule behavior without page-specific overrides.

- [ ] **Step 5: Implement residue layer**

Own selection, caret, scrollbar, cursor, resize and default form-control residue only where current UI does not intentionally delegate to native platform behavior.

- [ ] **Step 6: Validate**

```bash
npm run validate:ui-tokens
node --test tests/ui-v3-perfection-authority.test.mjs tests/ui-v3-tokens.test.mjs tests/ui-v3-accessibility.test.mjs
npm run build:ui-v3
```

- [ ] **Step 7: Commit**

```bash
git add ui-v3/styles/perfection ui-v3/styles/index.css ui-v3/styles/tokens tests/ui-v3-perfection-authority.test.mjs
git commit -m "feat(ui): add systemic micro-detail and density regimes"
```

---

### Task 4: Harden shell continuity and experience switching

**Files:**
- Modify: `ui-v3/shell/app-shell.mjs`
- Modify: `ui-v3/shell/global-rail.mjs`
- Modify: `ui-v3/shell/session-sidebar.mjs`
- Modify: `ui-v3/components/experience-switcher/experience-switcher.mjs`
- Modify: relevant shell/layout CSS.
- Test: `tests/ui-v3-shell.test.mjs`
- Test: `tests/ui-v3-resizable-shell.test.mjs`
- Test: `tests/experience-switcher.test.mjs`
- Test: `tests/experience-switcher-wiring.test.mjs`
- Test: `tests/ui-v3-view-state-preserver.test.mjs`

- [ ] **Step 1: Add RED tests for context continuity**

Switch each experience level while a project + mission + nonzero route scroll + dirty Settings state exist. Assert semantic state survives while disclosure/density changes.

- [ ] **Step 2: Add RED focus restoration test**

Open and close command/search/experience overlays; assert focus returns to initiating control or intended route target.

- [ ] **Step 3: Implement only missing continuity/focus behavior**

Do not add a second state store. Reuse existing settings/view-state authorities.

- [ ] **Step 4: Apply regime-specific shell density**

Everyday must not simply hide Expert buttons; navigation grouping and information priority may change while critical truth remains reachable.

- [ ] **Step 5: Verify**

```bash
node --test tests/ui-v3-shell.test.mjs tests/ui-v3-resizable-shell.test.mjs tests/experience-switcher.test.mjs tests/experience-switcher-wiring.test.mjs tests/ui-v3-view-state-preserver.test.mjs
npm run build:ui-v3
```

- [ ] **Step 6: Runtime capture shell in 4 regimes at 1440 and 980**

Bind only observed `PFX-SHELL-*` items.

- [ ] **Step 7: Commit**

```bash
git commit -am "feat(ui): make experience regimes preserve product continuity"
```

---

### Task 5: Close onboarding, Home and Projects as the adoption path

**Files:**
- Modify: `ui-v3/views/onboarding/onboarding-view.mjs`
- Modify: `ui-v3/views/home/home-view.mjs`
- Modify: `ui-v3/views/projects/project-view.mjs`
- Modify: `ui-v3/styles/pages/onboarding.css`
- Modify: `ui-v3/styles/pages/home.css`
- Modify: `ui-v3/styles/pages/projects.css`
- Tests: `tests/onboarding-ui.test.mjs`, `tests/ui-v3-home.test.mjs`, `tests/ui-v3-project-view.test.mjs`, `tests/ui-v3-project-picker.test.mjs`, `tests/ui-v3-project-switcher.test.mjs`.

- [ ] **Step 1: Enumerate required user-visible states from catalog**

For each surface include populated/empty/loading/error/unavailable and long-content cases. Add fixtures only when backed by actual view model inputs.

- [ ] **Step 2: Write RED tests for missing states/copy/focus**

Examples: unavailable project has recovery path; onboarding back preserves choice; Home running mission remains visible in Everyday; long project name exposes full value.

- [ ] **Step 3: Implement structural corrections**

Prefer clearer hierarchy/state ownership over added decoration.

- [ ] **Step 4: Run focused tests + EN/VI assertions**

```bash
node --test tests/onboarding-ui.test.mjs tests/ui-v3-home.test.mjs tests/ui-v3-project-view.test.mjs tests/ui-v3-project-picker.test.mjs tests/ui-v3-project-switcher.test.mjs
```

- [ ] **Step 5: Render 4 widths, light/nocturne and long Vietnamese fixtures**

Run Axe in every captured material state.

- [ ] **Step 6: Critique cycle**

Check optical centering, text wrapping, empty-state balance, selection state, focus, radius/border residue and signature saturation. Apply correction and re-render.

- [ ] **Step 7: Commit**

```bash
git commit -am "feat(ui): close Nolane adoption surfaces at micro-detail level"
```

---

### Task 6: Close Mission/Activity/Review truth hierarchy

**Files:**
- Modify: `ui-v3/views/mission/*`
- Modify: `ui-v3/views/activity/activity-view.mjs`
- Modify: `ui-v3/views/review/*`
- Modify: `ui-v3/styles/pages/mission-proofline.css`
- Modify: `ui-v3/styles/pages/mission-proofline-accessibility.css`
- Modify: `ui-v3/styles/pages/review.css`
- Tests: `tests/ui-v3-mission-components.test.mjs`, `tests/ui-v3-execution-story.test.mjs`, `tests/ui-v3-progressive-activity.test.mjs`, `tests/ui-v3-time-travel.test.mjs`, `tests/ui-v3-review.test.mjs`, `tests/ui-v3-review-flow.test.mjs`.

- [ ] **Step 1: RED tests for semantic state separation**

Ensure generated/planned/action/evidence/reviewed/verified/unknown/blocked/partial states cannot share success semantics accidentally.

- [ ] **Step 2: RED streaming/history test**

When user inspects older events, streaming additions must not force scroll to bottom; expose a controlled “jump to latest” path only when required.

- [ ] **Step 3: Implement trace/state corrections**

Use Evidence Spine only where it improves provenance/recovery comprehension.

- [ ] **Step 4: Verify focused suite**

```bash
node --test tests/ui-v3-mission-components.test.mjs tests/ui-v3-execution-story.test.mjs tests/ui-v3-progressive-activity.test.mjs tests/ui-v3-time-travel.test.mjs tests/ui-v3-review.test.mjs tests/ui-v3-review-flow.test.mjs
```

- [ ] **Step 5: Render mission running/blocked/recovered/completed + Review approve/reject/unknown**

Run hierarchy/grayscale and residue critique, correct, re-render.

- [ ] **Step 6: Commit**

```bash
git commit -am "feat(ui): close mission and review truth semantics"
```

---

### Task 7: Close Studio and Browser as professional work surfaces

**Files:**
- Modify: `ui-v3/views/workroom/*`
- Modify: `ui-v3/views/browser/*`
- Modify: `ui-v3/styles/pages/workroom.css`
- Modify: `ui-v3/styles/pages/workroom-terminal.css`
- Modify: `ui-v3/styles/pages/browser.css`
- Tests: `tests/ui-v3-workroom.test.mjs`, `tests/ui-v3-workroom-lazy.test.mjs`, `tests/ui-v3-browser-workspace.test.mjs`, `tests/integrated-browser-center-ui.test.mjs`.

- [ ] **Step 1: Add RED pane-continuity tests**

Collapse/reopen panes and change routes; assert mission/file/scroll/selection data intended to persist remains intact.

- [ ] **Step 2: Add RED compact-layout test**

At ≤640, Studio must expose explicit pane switching and must not produce a three-column squeezed layout.

- [ ] **Step 3: Add RED browser trust-boundary tests**

Origin/session/permission state must remain visible and external content must not visually merge with trusted Nolane chrome.

- [ ] **Step 4: Implement missing semantics and CSS**

Do not fake browser trust with color alone; include textual/icon/state semantics.

- [ ] **Step 5: Verify**

```bash
node --test tests/ui-v3-workroom.test.mjs tests/ui-v3-workroom-lazy.test.mjs tests/ui-v3-browser-workspace.test.mjs tests/integrated-browser-center-ui.test.mjs
npm run build:ui-v3
```

- [ ] **Step 6: Render Studio wide/compact, Browser trusted/untrusted/permission-blocked**

Correct typography, focus-entry/exit, panel density and native-residue findings, then re-render.

- [ ] **Step 7: Commit**

```bash
git commit -am "feat(ui): close professional Studio and Browser surfaces"
```

---

### Task 8: Close Skills, Settings and Control Plane

**Files:**
- Modify: `ui-v3/views/skills/skills-view.mjs`
- Modify: `ui-v3/views/settings/settings-view.mjs`
- Modify: `ui-v3/views/settings/settings-controller.mjs` only for proven behavior gaps.
- Modify: `ui-v3/control-plane/*`
- Modify: `ui-v3/styles/pages/skills.css`
- Modify: `ui-v3/styles/pages/settings.css`
- Modify: `ui-v3/styles/pages/control-plane.css`
- Tests: `tests/ui-v3-skills-library.test.mjs`, `tests/ui-v3-skills-progressive-render.test.mjs`, `tests/ui-v3-settings-controller.test.mjs`, `tests/ui-v3-settings-route.test.mjs`, `tests/ui-v3-control-plane*.test.mjs`.

- [ ] **Step 1: RED capability-state tests**

Installed/enabled/configured/ready/blocked must be distinguishable for skills/plugins/MCP data models that expose those states.

- [ ] **Step 2: RED Settings persistence tests**

Language/theme/search/deep-link changes must preserve intended route, scroll and focus state.

- [ ] **Step 3: RED Control Plane truth tests**

Configured provider/runtime must not render as healthy/ready unless health evidence says so.

- [ ] **Step 4: Implement UI/system corrections**

Keep Settings quiet; keep Control Plane dense and calibrated; avoid returning to bento dashboards.

- [ ] **Step 5: Verify focused suites and progressive performance**

```bash
node --test tests/ui-v3-skills-library.test.mjs tests/ui-v3-skills-progressive-render.test.mjs tests/ui-v3-settings-controller.test.mjs tests/ui-v3-settings-route.test.mjs tests/ui-v3-control-plane*.test.mjs
```

- [ ] **Step 6: Render light/nocturne, EN/VI, search/non-search, ready/blocked states**

Correct and re-render.

- [ ] **Step 7: Commit**

```bash
git commit -am "feat(ui): close capability settings and expert system surfaces"
```

---

### Task 9: Complete product-wide content, accessibility and residue audit

**Files:**
- Modify: `ui-v3/core/i18n.mjs`
- Modify: shared/component/page CSS only where findings require it.
- Modify: `ui-v3/styles/accessibility-runtime.css`
- Test: `tests/ui-v3-accessibility.test.mjs`
- Test: `tests/ui-v3-motion-policy.test.mjs`
- Create: `tests/ui-v3-content-contract.test.mjs`
- Create: `tests/ui-v3-platform-residue.test.mjs`

- [ ] **Step 1: RED content contract tests**

Assert no unexpected English fallback in declared Vietnamese fixture states, destructive actions name scope, empty states contain next action and provider/model proper names remain canonical.

- [ ] **Step 2: RED residue contract tests**

Verify intended CSS/state authority exists for selection, caret, scrollbars, resize cursors, focus and tooltips while preserving native controls where deliberately delegated.

- [ ] **Step 3: Implement bounded corrections**

Do not globally restyle controls merely for visual uniformity.

- [ ] **Step 4: Run static audits**

```bash
npm run audit:ui-quality
npm run validate:ui-tokens
node --test tests/ui-v3-accessibility.test.mjs tests/ui-v3-motion-policy.test.mjs tests/ui-v3-content-contract.test.mjs tests/ui-v3-platform-residue.test.mjs
```

- [ ] **Step 5: Runtime keyboard/reduced-motion/forced-colors capture**

Add states to the canonical visual workflow rather than using one-off screenshots as final evidence.

- [ ] **Step 6: Commit**

```bash
git commit -am "fix(ui): close content accessibility and platform residue gaps"
```

---

### Task 10: Expand canonical runtime visual matrix and bind PFX evidence

**Files:**
- Modify: `scripts/capture-ui-runtime-visual.mjs`
- Modify: `scripts/capture-ui-v3-states.mjs`
- Modify: `.github/workflows/ui-runtime-visual.yml` or current canonical visual workflow path.
- Modify: `tests/ui-runtime-visual-workflow.test.mjs`
- Modify: `requirements/product-perfection-matrix.json` through generator only.

- [ ] **Step 1: RED workflow test**

Require capture inventory to include primary routes across 1440, 1180, 980 and 640 where meaningful; light/nocturne; EN/VI long-copy fixtures; reduced motion; keyboard/focus states; material error/blocked/empty states.

- [ ] **Step 2: Add bounded state inventory**

Do not create a combinatorial screenshot explosion. Use risk-driven coverage: every route gets baseline responsive/theme states; high-risk surfaces get additional semantic states.

- [ ] **Step 3: Capture geometry metadata next to screenshots**

Record viewport, route, experience, theme, locale, scroll, active element, overflow status and Axe result.

- [ ] **Step 4: Bind observed PFX IDs**

Evidence binding must reference exact workflow run/artifact/state IDs. Unsupported catalog items remain UNKNOWN/BLOCKED.

- [ ] **Step 5: Verify workflow contract locally and on PR**

```bash
node --test tests/ui-runtime-visual-workflow.test.mjs
```

- [ ] **Step 6: Close two NUI critique cycles on the consolidated candidate**

Cycle A: silhouette/hierarchy/optical density.  
Cycle B: typography/material/residue/nocturne/localization/focus.

Each cycle requires written findings, source correction and re-observation.

- [ ] **Step 7: Commit**

```bash
git commit -am "test(ui): expand risk-driven product perfection runtime matrix"
```

---

### Task 11: Performance, evidence ledgers and external-gate convergence

**Files:**
- Modify: `scripts/capture-ui-performance-evidence.mjs`
- Modify: `.github/workflows/ui-runtime-performance.yml` or canonical equivalent.
- Modify: `tests/ui-performance-runtime-evidence.test.mjs`
- Modify through generators: native conformance, Nolane requirement registry, master acceptance ledger, evidence freshness.
- Modify: external gate workflow only where evidence collection is actually improved.

- [ ] **Step 1: RED performance budget tests for changed surfaces**

Cover route-switch p95, long tasks, DOM count, idle CPU/memory where existing harness supports them. Add streaming input-responsiveness measurement if the harness can produce a trustworthy value.

- [ ] **Step 2: Run Linux/Windows candidate performance evidence**

Do not label hosted runner results as “8 GB certification” unless the runner is machine-labelled accordingly.

- [ ] **Step 3: Regenerate evidence chain in dependency order**

```text
source/runtime evidence
→ native-core conformance
→ Nolane requirement registry
→ master acceptance ledger LAST
→ evidence freshness
→ UI release verification
→ product-perfection matrix
```

- [ ] **Step 4: Run external Linux/macOS/Windows PR evidence**

Keep provider-real/credentialed gates blocked when credentials are absent. PR-only bounded certification remains PR-provenance-bound.

- [ ] **Step 5: Verify exact candidate SHA workflow families**

Required minimum: main CI, visual, performance, Proofline/evidence workflows, external platform receipts, product-perfection verifier.

- [ ] **Step 6: Commit generated evidence only when canonical generators pass**

```bash
git commit -am "chore(evidence): synchronize perfection and acceptance evidence"
```

---

### Task 12: Complete release/update product path after UI/product stabilization

**Files:**
- Inspect/modify: `.github/workflows/*release*`
- Inspect/modify: `scripts/full-release-matrix.mjs`
- Inspect/modify: `scripts/build-electron.mjs`
- Inspect/modify: `scripts/build-electron-installer.mjs`
- Inspect/modify: `scripts/package-release-artifacts.mjs`
- Inspect/modify: `scripts/verify-release-artifacts.mjs`
- Inspect/modify: update coordinator/service/controller files under `src/` and Electron wiring only for proven gaps.
- Tests: existing `electron-update-*`, `update-*`, installer/release tests and new platform-specific regression tests as required.

- [ ] **Step 1: Inventory exact release claims by platform**

Create one machine-readable platform table: asset formats, signing status, notarization status, installer handoff, in-app update handoff, recovery evidence. Default unknown items to BLOCKED/UNKNOWN.

- [ ] **Step 2: RED tests for release metadata truth**

If macOS/Linux native install/update handoff is disabled, UI/metadata must say so; it must not inherit Windows “ready to install” semantics.

- [ ] **Step 3: Harden GitHub release workflow**

Tag-triggered jobs must build:

- Windows NSIS;
- macOS DMG + ZIP;
- Linux AppImage + DEB;
- shared checksums/provenance.

Signing/notarization steps are conditional on actual secrets and fail closed for a release that claims signed production status.

- [ ] **Step 4: Add/update smoke receipts**

Where infrastructure permits, verify artifact opens/installs/launches and exposes expected version. Never substitute archive existence for installation proof.

- [ ] **Step 5: Verify update/recovery state machine**

Run existing checkpoint-14 update tests plus new platform truth tests. Prove no-data-loss replay to the exact level claimed.

- [ ] **Step 6: Exact release-candidate gate**

No release publish until source/UI/perfection/evidence workflows are green on the exact release candidate.

- [ ] **Step 7: Publish GitHub Release from Actions**

Only after required gates. Generate/update manifest from the same release process.

- [ ] **Step 8: Commit release-path corrections before tag**

```bash
git commit -am "feat(release): close verified cross-platform update path"
```

---

### Task 13: Final integration, post-merge verification and durable delivery

**Files:**
- Update: `docs/checkpoints/product-perfection/RESUME-CANONICAL.md`
- Update: critique/evidence docs produced during Tasks 2–12.
- Generate: COMPLETE ZIP + checksum + verification manifest.

- [ ] **Step 1: Run full pre-merge exact-SHA verification**

```bash
npm run validate
npm run build:ui-v3
npm run validate:ui-tokens
npm run audit:ui-quality
npm run verify:ui-v3-release
npm run verify:product-perfection
```

Also require the GitHub runtime visual/performance/external/release-relevant workflow matrix appropriate to the candidate.

- [ ] **Step 2: Merge only with expected head SHA protection**

No source change after final exact-SHA verification without rerunning affected gates.

- [ ] **Step 3: Run post-merge CI + external platform receipts**

PR-only certification candidate must skip on push by design if provenance rules require PR receipts.

- [ ] **Step 4: Package exact canonical merged Git SHA**

Include:

- complete project excluding `.git`;
- master spec;
- micro-detail catalog;
- implementation plan;
- continuation checkpoint;
- product-perfection matrix;
- critique records;
- final visual/performance/external/release receipts available for the milestone;
- `MILESTONE-VERIFICATION.json`.

- [ ] **Step 5: Verify archive**

```bash
unzip -t Nolane-agent-Product-Perfection-v3-COMPLETE.zip
sha256sum Nolane-agent-Product-Perfection-v3-COMPLETE.zip
```

- [ ] **Step 6: Persist to ChatGPT Library**

Upload ZIP and checksum. Do not claim persistence until the Files operation returns success.

- [ ] **Step 7: Final checkpoint update**

`RESUME-CANONICAL.md` must contain exact final Git SHA, workflow run IDs, remaining external gates, release/update truth and the next authorized action.

- [ ] **Step 8: Commit checkpoint if it changed before final merge; otherwise include it in the verified tree before packaging**

---

## Self-review of plan against spec

- Product goal: covered by Tasks 4–13.
- Four experience regimes: Tasks 3–5.
- Micro-detail closure: Tasks 1, 3, 5–10.
- Projects known anomaly: Task 2 with mandatory measurement before mutation.
- Accessibility/residue/localization: Tasks 3, 9, 10.
- Performance: Task 11.
- External evidence discipline: Tasks 1, 11, 12, 13.
- Windows/macOS/Linux Electron release: Task 12.
- Update/recovery: Task 12.
- Exact-SHA/ZIP/Library durability: Task 13.
- No placeholder tasks or blanket “add tests” steps remain; each task names concrete files, commands and failure semantics.
