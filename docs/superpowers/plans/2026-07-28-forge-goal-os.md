# Forge Goal OS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add durable goals, adaptive replanning, commands, governed browser automation, plugin compatibility, layered settings, scheduling, and a live mission graph to Forge Studio.

**Architecture:** Add focused services above the existing StudioStore and MissionRunner. External ecosystems are adapters and remain governed by ForgeOS. Heavy optional systems are detected and lazy-loaded.

**Tech Stack:** Node.js 22, node:sqlite, existing ForgeOS bridge, JSONL/stdio adapters, official Playwright CLI integration, Electron renderer.

## Global Constraints

- Existing 0.5 functionality and tests must remain compatible.
- ForgeOS remains the authority for tools, permissions, evidence, and completion.
- No secret may be persisted in SQLite or returned to the renderer.
- Browser and plugin content is untrusted.
- No imported plugin hook executes during installation.
- Heavy optional dependencies must not load during default startup.

---

### Task 1: Goal persistence and revisions

**Files:**
- Modify: `src/storage/studio-store.mjs`
- Create: `src/goals/goal-service.mjs`
- Test: `tests/goal-service.test.mjs`

**Interfaces:**
- Produces: `GoalService.create`, `get`, `list`, `update`, `attachMission`, `recordFact`, `listFacts`, `recordPlanRevision`, `listPlanRevisions`.

- [ ] Write tests for durable goal creation, criteria, budget, facts, revisions, and restart.
- [ ] Verify tests fail because GoalService is absent.
- [ ] Add indexed SQLite goal tables and focused store methods.
- [ ] Implement GoalService validation and events.
- [ ] Run the focused test and full suite.
- [ ] Commit.

### Task 2: Adaptive replanning

**Files:**
- Create: `src/goals/adaptive-replanner.mjs`
- Test: `tests/adaptive-replanner.test.mjs`

**Interfaces:**
- Consumes: `GoalService`, `StudioStore` task methods.
- Produces: `AdaptiveReplanner.observe`, `propose`, `apply`.

- [ ] Write tests for assumption invalidation, immutable completed tasks, task additions, updates, cancellations, and idempotent patch application.
- [ ] Verify red.
- [ ] Implement deterministic patch validation and application.
- [ ] Verify focused and full suites.
- [ ] Commit.

### Task 3: Slash command registry

**Files:**
- Create: `src/commands/command-registry.mjs`
- Create: `src/commands/core-commands.mjs`
- Test: `tests/command-registry.test.mjs`

**Interfaces:**
- Produces: `CommandRegistry.register`, `parse`, `execute`, `help`; `registerCoreCommands`.

- [ ] Test quoting, flags, aliases, suggestions, and goal/status/budget command dispatch.
- [ ] Verify red.
- [ ] Implement parser and registry with structured results.
- [ ] Verify focused and full suites.
- [ ] Commit.

### Task 4: Governed Playwright CLI browser

**Files:**
- Create: `src/browser/playwright-cli-driver.mjs`
- Create: `src/browser/browser-agent-service.mjs`
- Test: `tests/browser-agent-service.test.mjs`

**Interfaces:**
- Produces: `PlaywrightCliDriver.detect/run`; `BrowserAgentService.open/goto/snapshot/find/click/fill/type/screenshot/tabs/close/status`.

- [ ] Test argv-only execution, named session isolation, URL policy, bounded output, artifact paths, and missing-driver diagnostics.
- [ ] Verify red.
- [ ] Implement lazy driver detection and governed actions.
- [ ] Verify focused and full suites.
- [ ] Commit.

### Task 5: Claude-compatible plugin platform

**Files:**
- Create: `src/plugins/plugin-scanner.mjs`
- Create: `src/plugins/plugin-service.mjs`
- Test: `tests/plugin-service.test.mjs`

**Interfaces:**
- Produces: `PluginScanner.scanMarketplace/scanPlugin`; `PluginService.addMarketplace/list/install/activate/deactivate/publicView`.

- [ ] Test marketplace/plugin schemas, traversal, symlinks, hook quarantine, capability inventory, immutable cache, and project activation.
- [ ] Verify red.
- [ ] Implement metadata-only import and activation.
- [ ] Verify focused and full suites.
- [ ] Commit.

### Task 6: Layered settings and scheduler

**Files:**
- Create: `src/settings/layered-settings.mjs`
- Create: `src/goals/goal-scheduler.mjs`
- Test: `tests/layered-settings.test.mjs`
- Test: `tests/goal-scheduler.test.mjs`

**Interfaces:**
- Produces: `LayeredSettings.resolve`; `GoalScheduler.tick/start/stop`.

- [ ] Test precedence, provenance, locked keys, interval/repository triggers, idempotency, and overlap prevention.
- [ ] Verify red.
- [ ] Implement both services.
- [ ] Verify focused and full suites.
- [ ] Commit.

### Task 7: Live mission graph

**Files:**
- Create: `src/orchestration/mission-graph-projection.mjs`
- Test: `tests/mission-graph-projection.test.mjs`

**Interfaces:**
- Produces: `MissionGraphProjection.snapshot({ goalId, missionId })`.

- [ ] Test graph nodes, edges, active targets, findings, plan patches, usage, and blocker projection.
- [ ] Verify red.
- [ ] Implement bounded projection.
- [ ] Verify focused and full suites.
- [ ] Commit.

### Task 8: Composition, APIs, and UI command/goal panels

**Files:**
- Modify: `src/app.mjs`
- Modify: `src/server/routes.mjs`
- Modify: `ui/index.html`
- Modify: `ui/app.js`
- Modify: `ui/style.css`
- Test: `tests/goal-os-api.test.mjs`
- Test: `tests/goal-os-ui.test.mjs`

**Interfaces:**
- Adds `/api/goals`, `/api/goals/:id`, `/api/goals/:id/facts`, `/api/goals/:id/replan`, `/api/commands`, `/api/browser/*`, `/api/plugins/*`, `/api/settings/effective`, and `/api/mission-graph`.

- [ ] Test real route wiring and no fake controls.
- [ ] Verify red.
- [ ] Wire services and add lazy Goal/Graph/Plugins/Browser views plus command palette.
- [ ] Verify focused and full suites.
- [ ] Commit.

### Task 9: Release, documentation, and verification

**Files:**
- Modify: `package.json`
- Modify: `src/version.mjs`
- Modify: `README.md`
- Modify: `docs/USER-GUIDE.md`
- Create: `docs/RELEASE-0.6.0.md`
- Create: `docs/VERIFICATION-REPORT-0.6.0.md`

- [ ] Update version and usage documentation.
- [ ] Run Node, ForgeOS, Go, smoke, packaging, manifest, ZIP, PE, and hash gates.
- [ ] Build source, Windows portable, update payload, binary, manifests, and checksums.
- [ ] Commit verification evidence.
