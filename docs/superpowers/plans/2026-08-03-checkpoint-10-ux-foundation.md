# Checkpoint 10 UX Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-wired Settings Center, model-intelligence registry, live Output Summary, persistent resizable shell, two-level Standard/Research experience, and complete release evidence for checkpoint 10.

**Architecture:** Extend the existing layered settings and provider services with focused registries and bounded APIs, then replace the static UI v3 settings route with a schema-driven client. Add reusable UI controllers for layout and summary rather than embedding behavior in route templates. Preserve all existing backend contracts and non-claims.

**Tech Stack:** Node.js 22 ESM, built-in `node:test`, static ES modules, CSS custom properties/container-aware responsive CSS, existing Nolane HTTP server, atomic JSON persistence.

## Global Constraints

- No new runtime dependency is required for core UI or settings.
- Secrets must remain in the credential vault and must never appear in settings/profile responses.
- Standard and Research modes share one backend and one UI codebase.
- All new APIs return bounded, sanitized JSON.
- All existing tests and release gates must continue to pass.
- Existing comparative-superiority, provider-real, NolaneNative-parity, and external-certification non-claims remain locked.

---

### Task 1: Settings catalog and complete defaults

**Files:**
- Create: `src/settings/settings-catalog.mjs`
- Modify: `src/settings/settings-service.mjs`
- Modify: `src/app.mjs`
- Test: `tests/settings-catalog.test.mjs`
- Test: `tests/settings-service.test.mjs`

**Interfaces:**
- Produces: `createSettingsCatalog()`, `validateSettingsPatch(patch, catalog)`, `SettingsService.catalog()`, `SettingsService.reset({ layer, projectId, paths })`.

- [ ] Write failing tests for catalog categories, Standard/Research visibility, validation, secret exclusion, and scoped reset.
- [ ] Run focused tests and confirm failure.
- [ ] Implement immutable catalog, path-aware validators, expanded defaults, catalog snapshot, and atomic reset.
- [ ] Run focused tests and confirm pass.
- [ ] Commit `feat(settings): add schema-driven settings catalog`.

### Task 2: Model profile registry and seed families

**Files:**
- Create: `src/providers/model-profile-registry.mjs`
- Create: `config/model-families.json`
- Test: `tests/model-profile-registry.test.mjs`

**Interfaces:**
- Produces: `ModelProfileRegistry.upsert()`, `.get()`, `.list()`, `.mergeDiscovery()`, `.recordProbe()`, `.publicView()`.

- [ ] Write failing tests for normalization, immutable snapshots, precedence, unknown-vs-false capability state, aliases, lifecycle, and secret stripping.
- [ ] Run focused test and confirm failure.
- [ ] Implement registry and a seed family catalog containing provider/family patterns rather than brittle exhaustive IDs.
- [ ] Run focused test and confirm pass.
- [ ] Commit `feat(models): add normalized model profile registry`.

### Task 3: Model discovery and capability probes

**Files:**
- Create: `src/providers/model-discovery-service.mjs`
- Create: `src/providers/model-capability-probe-service.mjs`
- Modify: `src/providers/provider-connection-service.mjs`
- Test: `tests/model-discovery-service.test.mjs`
- Test: `tests/model-capability-probe-service.test.mjs`

**Interfaces:**
- Produces: `discover({ providerId })`, `probe({ providerId, modelId, probes })`, provider connection methods `discoverModels` and `probeModel`.

- [ ] Write failing adapter tests for OpenAI-compatible, Gemini, Ollama, and generic model responses.
- [ ] Write failing probe tests for bounded text/tool/structured/streaming classification and sanitized errors.
- [ ] Implement discovery without persistent credential exposure and opt-in probes.
- [ ] Run focused tests and confirm pass.
- [ ] Commit `feat(models): discover and probe provider capabilities`.

### Task 4: Settings, profiles, and summary HTTP APIs

**Files:**
- Create: `src/ui/ui-summary-service.mjs`
- Modify: `src/server/routes.mjs`
- Modify: `src/app.mjs`
- Test: `tests/settings-http-api.test.mjs`
- Test: `tests/model-profile-http-api.test.mjs`
- Test: `tests/ui-summary-service.test.mjs`
- Test: `tests/ui-summary-http-api.test.mjs`

**Interfaces:**
- Produces endpoints: `GET /api/settings/catalog`, `GET /api/settings/effective`, `PUT /api/settings`, `POST /api/settings/reset`, `GET /api/model-profiles`, `POST /api/model-profiles/discover`, `POST /api/model-profiles/probe`, `GET /api/ui/summary`.

- [ ] Write failing service and route tests, including bounded output and unavailable subsystem behavior.
- [ ] Implement service composition and routes.
- [ ] Run focused tests and confirm pass.
- [ ] Commit `feat(api): expose UX foundation runtime snapshots`.

### Task 5: Settings API client and state model

**Files:**
- Create: `ui-v3/core/api-client.mjs`
- Create: `ui-v3/views/settings/settings-controller.mjs`
- Replace: `ui-v3/views/settings/settings-view.mjs`
- Test: `tests/ui-v3-settings-controller.test.mjs`
- Modify: `tests/ui-v3-secondary-views.test.mjs`

**Interfaces:**
- Produces: `createApiClient()`, `createSettingsController()`, `renderSettingsView(snapshot)`.

- [ ] Write failing tests for load, category search, Standard/Research filtering, draft validation, save/reset payloads, provenance, and error states.
- [ ] Implement a DOM-independent controller and schema-driven renderer.
- [ ] Run focused tests and confirm pass.
- [ ] Commit `feat(ui): build production-wired settings center`.

### Task 6: Interactive Settings route and immediate preferences

**Files:**
- Modify: `ui-v3/app.mjs`
- Create: `ui-v3/core/preference-runtime.mjs`
- Create: `ui-v3/styles/pages/settings.css`
- Modify: `ui-v3/styles/index.css`
- Test: `tests/ui-v3-settings-wiring.test.mjs`
- Test: `tests/ui-v3-accessibility.test.mjs`

**Interfaces:**
- Produces: settings route lifecycle `mount(root)`, immediate document preference application, save announcements.

- [ ] Write failing wiring/static accessibility tests.
- [ ] Implement async route mount, delegated form events, save/reset/retry actions, theme/density/experience application, and focus restoration.
- [ ] Run focused tests and build UI v3.
- [ ] Commit `feat(ui): wire settings controls to persisted backend`.

### Task 7: Persistent resizable shell

**Files:**
- Create: `ui-v3/core/layout-store.mjs`
- Create: `ui-v3/core/resizable-region.mjs`
- Modify: `ui-v3/shell/app-shell.mjs`
- Modify: `ui-v3/styles/layout/app-shell.css`
- Modify: `ui-v3/styles/responsive.css`
- Test: `tests/ui-v3-layout-store.test.mjs`
- Test: `tests/ui-v3-resizable-shell.test.mjs`

**Interfaces:**
- Produces: `createLayoutStore(storage)`, `createResizableRegionController(options)`, shell resize handles with ARIA separators.

- [ ] Write failing tests for corruption recovery, clamping, pointer/keyboard semantics, reset, and persisted custom properties.
- [ ] Implement controllers and shell markup.
- [ ] Run focused tests and confirm pass.
- [ ] Commit `feat(ui): add persistent keyboard-accessible panel resizing`.

### Task 8: Live Output Summary

**Files:**
- Create: `ui-v3/views/summary/output-summary.mjs`
- Modify: `ui-v3/shell/app-shell.mjs`
- Modify: `ui-v3/app.mjs`
- Create: `ui-v3/styles/components/output-summary.css`
- Test: `tests/ui-v3-output-summary.test.mjs`
- Test: `tests/ui-v3-output-summary-wiring.test.mjs`

**Interfaces:**
- Produces: `createOutputSummaryController({ api, pollMs })`, `renderOutputSummary(snapshot)`.

- [ ] Write failing tests for grouped outputs/processes/sources, bounded labels, empty/unavailable states, visibility-aware polling, and stop/manage actions.
- [ ] Implement summary UI and mount it globally.
- [ ] Run focused tests and confirm pass.
- [ ] Commit `feat(ui): add live outputs processes and sources summary`.

### Task 9: Model Profiles UI and routing diagnostics

**Files:**
- Create: `ui-v3/views/settings/model-profiles-panel.mjs`
- Modify: `ui-v3/views/settings/settings-view.mjs`
- Modify: `ui-v3/views/settings/settings-controller.mjs`
- Test: `tests/ui-v3-model-profiles.test.mjs`

**Interfaces:**
- Produces: model card rendering, discovery/probe actions, capability matrix, source/probe/observed distinction, Research-only routing diagnostics.

- [ ] Write failing renderer/controller tests.
- [ ] Implement cards, filters, lifecycle badges, unknown states, probe receipts, and model discovery action.
- [ ] Run focused tests and confirm pass.
- [ ] Commit `feat(ui): expose model intelligence and probes`.

### Task 10: Responsive, short-window, and accessibility completion

**Files:**
- Modify: `ui-v3/styles/responsive.css`
- Modify: `ui-v3/styles/base/typography.css`
- Modify: `ui-v3/styles/base/motion.css`
- Modify: `ui-v3/index.html`
- Test: `tests/ui-v3-responsive-completion.test.mjs`
- Modify: `scripts/audit-ui-capabilities.mjs`

**Interfaces:**
- Produces: compact/narrow/short-height contracts, no-feature-loss drawers, safe-area handling, reduced-motion and forced-colors support.

- [ ] Write failing static contract tests for breakpoints, height queries, safe areas, forced colors, 200% zoom-friendly minimums, and overflow containment.
- [ ] Implement CSS and audit additions.
- [ ] Run focused tests, token validation, and UI build.
- [ ] Commit `feat(ui): complete adaptive desktop experience`.

### Task 11: UX foundation release verifier and documentation

**Files:**
- Create: `src/release/checkpoint-10-ux-foundation-verifier.mjs`
- Create: `scripts/verify-checkpoint-10-ux-foundation.mjs`
- Modify: `scripts/full-release-matrix.mjs`
- Create: `docs/CHECKPOINT-10-UX-FOUNDATION.md`
- Create: `docs/MODEL-PROFILE-CATALOG.md`
- Test: `tests/checkpoint-10-ux-foundation-release-gate.test.mjs`

**Interfaces:**
- Produces: deterministic verifier receipt and a required Full Release Matrix gate named `checkpoint-10-ux-foundation`.

- [ ] Write failing release-gate test.
- [ ] Implement verifier covering API wiring, UI closure, tests, catalog integrity, resizer, summary, and non-claim preservation.
- [ ] Add documentation and matrix gate.
- [ ] Run verifier and focused test.
- [ ] Commit `chore(release): gate checkpoint 10 UX foundation`.

### Task 12: Full verification and release packaging

**Files:**
- Modify/generated: `release/*`
- Create/generated: top-level checkpoint reports and checksum manifests.

**Interfaces:**
- Produces the release outputs enumerated in the design specification.

- [ ] Run all focused new tests.
- [ ] Run `npm test`, UI build, syntax, runtime smoke, Go tests, Python SDK tests, checkpoint 10 verifier, and UX verifier.
- [ ] Run the complete Full Release Matrix and inspect every failure/skip.
- [ ] Generate source ZIP, Git bundle, patch, evidence ZIP, reports, and checksum manifests from the verified commit.
- [ ] Re-run archive/source reconstruction and checksum verification against packaged outputs.
- [ ] Record any environment-specific external-unverified artifacts without overstating certification.
- [ ] Commit final generated evidence with `chore(release): publish checkpoint 10 UX foundation evidence`.
