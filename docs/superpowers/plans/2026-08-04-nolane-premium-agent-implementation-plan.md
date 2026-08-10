# Nolane Premium Agent Experience — implementation plan

Date: 2026-08-04  
Input audit: `docs/checkpoints/checkpoint-14/NOLANE-WHOLE-PRODUCT-AUDIT-2026-08-04.md`  
UX contract: `docs/superpowers/specs/2026-08-04-nolane-premium-agent-experience-design.md`

## 1. Objective

Converge Nolane's substantial backend into a coherent, premium, testable desktop agent product. Fix the current P0 interaction defects first, then deliver exact project/model/context selection, provider/account setup, skill/plugin/ForgeOS surfaces, browser and Studio visibility, and evidence-backed release gates.

## 2. Global constraints

- Preserve the current dirty worktree. Never reset, clean, or overwrite unrelated changes.
- Work in vertical slices. One slice must produce a visible behavior plus a focused test.
- Use `apply_patch` for source edits.
- No static provider/model catalog may be labelled “discovered”.
- No secret, OAuth token, password, or cookie may appear in UI state, logs, fixtures, snapshots, or receipts.
- Keep Electron folder selection as the production project-creation path.
- Treat ForgeOS as a pinned dependency/facade; do not fork its truth logic into UI code.
- A test that only checks source text or rendered HTML does not close an interaction requirement.
- Any external-provider claim requires provider-real evidence; otherwise use `available`, `configured`, `untested`, or `external gate` language.

## 3. Sequencing map

```text
Wave 0 truth baseline
  -> Wave 1 stable UI state
  -> Wave 2 workspace + composer contracts
  -> Wave 3 providers/accounts/models
  -> Wave 4 commands + context
  -> Wave 5 Skill Hub + plugins
  -> Wave 6 ForgeOS intelligence
  -> Wave 7 Browser workspace
  -> Wave 8 real Studio
  -> Wave 9 sessions/agents/review
  -> Wave 10 harness expansion
  -> Wave 11 premium visual system
  -> Wave 12 certification and release
```

Waves 5–8 can proceed in parallel only after Waves 1–4 stabilize shared contracts.

## 4. Wave 0 — truthful baseline and behavioral ledger

### Task 0.1: Add product behavior coverage schema

Create:

- `requirements/product-behavior-coverage.schema.json`
- `requirements/product-behavior-coverage.json`
- `scripts/audit-product-behavior-coverage.mjs`
- `tests/product-behavior-coverage.test.mjs`

Each behavior record contains:

```json
{
  "id": "NPA-SETTINGS-001",
  "surface": "settings",
  "promise": "Changing a setting preserves position and focus",
  "source": [],
  "unitTests": [],
  "journeyTests": [],
  "externalEvidence": [],
  "states": ["success", "error"],
  "status": "missing"
}
```

Allowed status computation:

- `source_only`: implementation path exists, no behavior test.
- `tested_local`: focused unit/integration plus journey test.
- `external_gate`: cannot be certified locally; reason and receipt schema required.
- `verified_external`: current external receipt passes the existing verifier.

Never manually set `complete`.

Verify:

```powershell
node --test tests/product-behavior-coverage.test.mjs
node scripts/audit-product-behavior-coverage.mjs
```

### Task 0.2: Normalize gate display without merging ledgers

Create a read-only `GateLedgerService` that reads historical feature audits and native checkpoint data into separate views.

Create/modify:

- `src/evidence/gate-ledger-service.mjs`
- `src/server/routes.mjs`: `GET /api/gates/ledgers`, `GET /api/gates/ledgers/:id`
- `tests/gate-ledger-service.test.mjs`
- `tests/gate-ledger-http-api.test.mjs`

Acceptance:

- 3.5 returns 63 external and 59 partial.
- beta6 returns 5 external.
- native checkpoint returns 15 external contracts and 5 open requirements.
- The API includes source path, schema/version, environment, generated time, and claim flags.

### Task 0.3: Fix Windows SQLite test lifecycle

Inspect `StudioStore` and provider tests. Add an explicit `close()` or use existing disposal API; register cleanup before temp directory removal.

Modify only as required:

- `src/persistence/studio-store.mjs` or actual owning store file
- `tests/provider-connections.test.mjs`

Red test: running the file on Windows must not fail with `EBUSY` for `.db`, `-wal`, or `-shm`.

Verify:

```powershell
node --test tests/provider-connections.test.mjs
```

Exit criteria for Wave 0:

- Behavior registry exposes current gaps instead of reporting zero missing UI gaps.
- Gate counts retain provenance.
- Provider connection test failures are assertion failures or passes, never cleanup noise.

## 5. Wave 1 — stable UI rendering and settings

### Task 1.1: Reproduce scroll reset in an automated journey

Create:

- `tests/ui-v3-settings-scroll-state.test.mjs`
- `tests/journeys/settings-preserves-scroll.mjs` if the repository journey harness supports it

Test sequence:

1. Mount settings with enough rows to scroll.
2. Set `.settings-content.scrollTop = 4200`.
3. Toggle `editor.confirmMultiLinePaste` or the current multiline-paste path.
4. Assert the same setting remains visible, scroll delta is below 2 px, focus remains on the switch, and the setting value changes.
5. Repeat for text input, select/choice, model action, and save error.

The test must fail against the current `mountedRoot.innerHTML = ...` behavior.

### Task 1.2: Introduce reusable view-state preservation

Create:

- `ui-v3/core/view-state-preserver.mjs`
- `tests/ui-v3-view-state-preserver.test.mjs`

Contract:

```js
captureViewState(root, {
  scroll: ['[data-scroll-key]'],
  focus: true,
  selection: true,
  disclosures: true
})
restoreViewState(root, snapshot)
```

Use stable `data-scroll-key` and `data-preserve-key`; do not key by translated text or array index.

Preferred implementation for settings: update control attributes/value and dirty/save status without replacing the whole page. Use full rerender only for category/search/data refresh, wrapped by state capture/restore.

Modify:

- `ui-v3/app.mjs:206-217` shared rerender path
- `ui-v3/app.mjs:314-324` settings mount path
- `ui-v3/views/settings/settings-view.mjs`

### Task 1.3: Route settings by category

Modify:

- `ui-v3/core/router.mjs`
- `ui-v3/views/settings/settings-controller.mjs`
- `ui-v3/views/settings/settings-view.mjs`
- `ui-v3/styles/pages/settings.css`

Target URL:

- `#/settings/general`
- `#/settings/appearance`
- `#/settings/providers`
- etc.

Search mode may show multiple matched settings; ordinary mode renders one category. Back/forward restores category and scroll. The settings main area should no longer be approximately 15,000 px tall.

### Task 1.4: Complete language/theme propagation contracts

Retain the existing live-language work. Add tests for:

- English has no Vietnamese shell/home strings.
- Vietnamese updates shell, home, status, composer, and settings without reload.
- System language follows Electron/OS locale source.
- Theme/accent/density affect project picker, model picker, menus, modals, Studio, Browser, and Skill Hub.

Verify:

```powershell
node --test tests/ui-v3-settings-scroll-state.test.mjs tests/ui-v3-view-state-preserver.test.mjs tests/language-sync-controller.test.mjs tests/ui-v3-settings-controller.test.mjs tests/ui-v3-settings-wiring.test.mjs
npm run build:ui-v3
```

Exit criteria for Wave 1:

- No setting interaction jumps, loses focus, or closes unrelated disclosure state.
- Category navigation and search behave correctly at 640, 1024, and 1440 widths.
- Language and theme changes are visible on every currently shipped surface.

## 6. Wave 2 — canonical workspace and composer

### Task 2.1: Add canonical WorkspaceContext store

Create:

- `ui-v3/core/workspace-context-store.mjs`
- `tests/ui-v3-workspace-context-store.test.mjs`

Persist per window/session:

- `projectId`
- `sessionId`
- `taskId`
- exact deployment key

Consume from:

- shell/project sidebar
- home composer
- task/activity view
- Studio
- Browser
- model picker

Remove first-project fallbacks from user-visible execution paths. A surface that requires a project must show a project-required empty state.

### Task 2.2: Replace model/provider collision with deployment identity

Modify:

- `ui-v3/views/home/home-view.mjs`
- `ui-v3/views/home/mission-composer.mjs`
- `src/server/routes.mjs` mission plan input
- mission planning schema/service files found by tracing `/api/missions/plan`

Request shape:

```json
{
  "projectId": "...",
  "objective": "...",
  "intent": "build",
  "deployment": {
    "providerId": "codex-app-server",
    "accountId": "default",
    "endpointId": null,
    "modelId": "gpt-5.6-sol"
  },
  "contextRefs": [],
  "command": null
}
```

Keep backward compatibility only at the API boundary and mark the old `planningProviderId` path deprecated. Do not let compatibility logic leak back into UI state.

Red tests:

- Two models under one provider produce two distinct values.
- Selected model id reaches the planner.
- Missing/unknown model returns a typed `model_unavailable` error.
- `auto` resolves to a recorded deployment and receipt.

### Task 2.3: Create ComposerDraft and typed context references

Create:

- `ui-v3/core/composer-draft.mjs`
- `src/context/context-reference-schema.mjs`
- `src/context/context-reference-resolver.mjs`
- `tests/composer-draft.test.mjs`
- `tests/context-reference-resolver.test.mjs`

Supported first slice:

- file
- folder
- project
- tool
- skill
- plugin
- browser tab/screenshot

Every resolver checks scope and returns bounded/redacted context. Large file attachments remain file refs; no synthetic `@file:name` token is trusted by the backend.

### Task 2.4: Typed errors and recovery UI

Create:

- `src/errors/product-error.mjs`
- `ui-v3/components/error-notice/error-notice.mjs`
- `ui-v3/styles/components/error-notice.css`
- tests for mapping provider/RPC/process errors

Update the mission send path so `internal-error` becomes:

- concise localized summary;
- provider/model/project information;
- retry, reauth, choose model/project, or open diagnostics action;
- expandable redacted detail and correlation id.

Exit criteria for Wave 2:

- Selecting a project changes every project-bound surface.
- Selecting a model selects and sends an exact deployment.
- Context is typed; objective text remains user text.
- Failures are actionable and secret-safe.

## 7. Wave 3 — Provider, Account, and Model Center

### Task 3.1: Define provider inventory contracts

Create:

- `src/providers/harness-adapter-v1.mjs`
- `src/providers/model-inventory-adapter.mjs`
- `src/providers/provider-account-schema.mjs`
- `tests/harness-adapter-contract.test.mjs`

Contracts must distinguish:

- executable detection
- authentication
- account identity
- health
- model inventory
- session protocol
- command catalog
- extension support

### Task 3.2: Use Codex app-server `model/list`

Modify:

- `src/providers/codex-app-server.mjs`
- `src/providers/provider-connection-service.mjs`
- `src/providers/model-profile-registry.mjs`
- fixture and tests

After initialize, request `model/list` with pagination. Store:

- id/model/display name
- default/supported reasoning efforts
- hidden/default
- input modalities
- personality support
- optional upgrade metadata
- fetchedAt and app-server version

Also expose `modelProvider/capabilities/read` when stable and needed. Add a feature flag for experimental methods; do not invoke under-development plugin APIs in production clients.

### Task 3.3: Add API setup UX

Create:

- `ui-v3/views/providers/providers-view.mjs`
- `ui-v3/views/providers/provider-setup-dialog.mjs`
- `ui-v3/views/providers/model-inventory-panel.mjs`
- `ui-v3/styles/pages/providers.css`
- `tests/ui-v3-provider-center.test.mjs`

Use existing configure/test/login/logout routes. API key fields are write-only. `openai-compatible` supports safe loopback HTTP and HTTPS remote endpoints per existing service rules.

### Task 3.4: Add auth flows according to adapter capability

- Codex: app-server login start/cancel/status/logout.
- Claude: current fixed commands, with exact login type choices only.
- Gemini/OpenCode: display “login not supported by this adapter” until documented and tested.
- Reauth state is distinct from disconnected/error.

Do not import browser cookies. If a harness officially supports credential import, require source preview, explicit confirmation, and a credential-reference result.

### Task 3.5: Build premium model picker

Create:

- `ui-v3/components/model-picker/model-picker.mjs`
- `ui-v3/components/model-picker/model-picker.css`
- `tests/ui-v3-model-picker.test.mjs`

Keyboard and accessibility requirements:

- open/close with button, Escape, and outside click;
- search models;
- arrow navigation and typeahead;
- exact deployment selection;
- second level for effort/speed/advanced;
- unknown inventory state with truthful fallback.

Exit criteria for Wave 3:

- A new user can configure an API provider from the UI.
- A logged-in Codex account displays real `model/list` inventory.
- A task can select model and effort and the app-server receives them.
- Unsupported auth/model features are labelled, not faked.

## 8. Wave 4 — commands and context router

### Task 4.1: Command registry and dispatcher

Create:

- `src/commands/command-registry.mjs`
- `src/commands/command-dispatcher.mjs`
- `ui-v3/components/command-palette/command-palette.mjs`
- tests for availability, permission, dispatch, keyboard behavior

Migrate existing local intents and `/api/commands` into one typed catalog. A command specifies:

- id/title/description/group/keywords
- surface availability
- argument schema
- execution kind: local UI, backend service, prompt macro
- permission/risk
- result/recovery behavior

First release commands: project, model, plan, build, verify, review, diff, files, terminal, browser, skills, plugins, MCP, permissions, status, new, rename, fork, archive, stop.

### Task 4.2: Context index

Create:

- `src/context/context-index-service.mjs`
- `src/server/routes.mjs`: `GET /api/context/search?q=&projectId=&types=`
- `ui-v3/components/context-picker/context-picker.mjs`
- tests for scope, bounds, ranking, permission, and token cost

Results never include raw secret content. Provider/model results are selection shortcuts, not prompt context unless explicitly defined.

### Task 4.3: Context chips and request binding

Render chips with type icon, label, scope, warning, remove, and inspect. On submit:

- resolve references;
- derive MCP allowlist from approved tool refs;
- bind skill/plugin selection to project activation/context materialization;
- record a context receipt with selected ids and digests, not secret bodies.

Exit criteria for Wave 4:

- Selecting `/review` runs a command or changes mode; it is not inert prompt text.
- Selecting `@tool` produces an allowed tool reference in the mission contract.
- Selecting a file never silently inlines unbounded content.

## 9. Wave 5 — Nolane Skill Hub and Extension marketplace

### Task 5.1: Reuse PluginService intake rather than create a parallel installer

Add a facade:

- `src/skills/nolane-skill-registry-service.mjs`
- `src/skills/skill-package-view.mjs`
- `src/skills/skill-source-service.mjs`

The facade normalizes first-party skills, ForgeOS skills/techniques, plugin-bundled skills, and governed Git sources. Installation delegates immutable fetch/scan/trust/transparency to existing plugin or ForgeOS services.

### Task 5.2: Skill API

Add:

- `GET /api/skills/catalog`
- `GET /api/skills/catalog/:id`
- `GET/POST/DELETE /api/skills/sources`
- `POST /api/skills/install`
- `POST /api/skills/:id/activate`
- `POST /api/skills/:id/deactivate`
- `POST /api/skills/:id/update`
- `POST /api/skills/:id/rollback`
- `POST /api/skills/sync`

All mutation routes return trust/maturity/provenance and a receipt. Activation is project-scoped unless a manifest explicitly supports global activation.

### Task 5.3: Skill Hub UI

Create:

- `ui-v3/views/extensions/skill-hub-view.mjs`
- `ui-v3/views/extensions/skill-detail.mjs`
- `ui-v3/views/extensions/plugin-detail.mjs`
- `ui-v3/styles/pages/extensions.css`
- tests for empty/loading/error/quarantine/install/update/rollback

Never render “certified” from popularity or a green scan. Maturity derives from the source ledger and current receipts.

### Task 5.4: Import and compatibility

Add explicit import adapters for supported Codex/Claude skill/plugin layouts. Detect and preview:

- manifest/source
- skills
- commands
- agents
- hooks
- MCP config
- requested permissions

Hooks remain disabled/quarantined until reviewed. Do not run install scripts during discovery.

Exit criteria for Wave 5:

- User can browse, inspect, install, review, activate, update, roll back, and quarantine a skill/plugin.
- Every item shows source pin, license, trust, maturity, compatibility, and context cost.

## 10. Wave 6 — deep ForgeOS integration

### Task 6.1: Pin and verify the upstream

Create:

- `vendor/forge-os/UPSTREAM.json`
- `scripts/sync-forge-os.mjs`
- `tests/forgeos-upstream-provenance.test.mjs`

Record:

- `https://github.com/Nolane-x/forge-os`
- exact commit SHA
- version
- license
- sync timestamp
- required Nolane API compatibility
- source archive digest

Do not change vendored repository metadata until the discrepancy is verified against the designated upstream.

### Task 6.2: Create stable Nolane ForgeOS facade

Extend `ForgeOsBridge` or add `NolaneForgeFacade` with bounded methods:

- catalog search/inspect
- route preview
- context pack preview/materialize
- evidence/maturity snapshot
- federation sources/sync/conflicts/quarantine/revoke
- approval request/consume
- lane and sandbox status

Expose product routes with schemas and pagination. Avoid exporting internal ForgeOS storage objects.

### Task 6.3: ForgeOS Intelligence UI

Create:

- `ui-v3/views/forgeos/forgeos-view.mjs`
- `ui-v3/views/forgeos/route-inspector.mjs`
- `ui-v3/views/forgeos/context-pack-preview.mjs`
- `ui-v3/views/forgeos/federation-view.mjs`
- tests using real vendored fixtures

Required truth labels:

- 250 Agent Skills v1
- 128 deep technique contracts
- current maturity distribution
- final certification boundary
- source commit/freshness

Exit criteria for Wave 6:

- A user can see why a skill was selected/excluded and exactly which sections enter context.
- Federation remains quarantine-first and approval-gated.

## 11. Wave 7 — Browser workspace

### Task 7.1: Browser session API facade

The existing tool gateway is agent-oriented. Add user-facing read/action routes that still pass through browser permissions and lease/evidence controls.

Create/modify:

- `src/browser/browser-workspace-service.mjs`
- `src/server/routes.mjs`
- tests for project isolation, site permission, secret redaction, and consequential actions

### Task 7.2: Browser UI

Create:

- `ui-v3/views/browser/browser-view.mjs`
- `ui-v3/views/browser/browser-timeline.mjs`
- `ui-v3/views/browser/browser-inspector.mjs`
- `ui-v3/styles/pages/browser.css`

First slice may use periodic screenshots/snapshots instead of a live embedded webview, but it must show:

- active project/session/url/tabs;
- screenshot;
- current action and history;
- permissions/approvals;
- console/network/accessibility journey evidence;
- close/reset profile controls.

### Task 7.3: Secret and login interaction

Create a typed `secret_request` / `clarification_request` flow. Secret values are delivered to the browser action boundary, never persisted in transcript or journey output. Add redaction tests for fill/type errors and screenshots metadata.

Exit criteria for Wave 7:

- User and agent share observable browser state.
- A login can be completed by direct user interaction or secret request without exposing credentials to the model/logs.
- Sensitive actions require explicit confirmation.

## 12. Wave 8 — Real Studio

### Task 8.1: Project-bound file tree and read view

Wire existing workroom file APIs into `workroom-controller.mjs`. Support directory traversal guards, lazy tree expansion, filter, open file, binary/large-file states, and SHA-aware reads.

### Task 8.2: Diff and changes

Show task changes and unsaved preview diffs. Use workers for large diffs. Include file status, added/deleted lines, tests/evidence, and revert/request-change actions with approvals.

### Task 8.3: Terminal and agent activity

Wire terminal host to the actual session/PTY service; show terminal ownership, working directory, exit state, and stop. Agent pane consumes task events instead of “Agent is ready” placeholder copy.

### Task 8.4: Remove or disable every inert control

Add a test enumerating buttons/links in Studio and proving a handler, navigation, or disabled reason. No unlabeled `•••` menu without content.

Exit criteria for Wave 8:

- Selected project controls file, diff, terminal, browser, and agent panes.
- Every visible control has a verified action.

## 13. Wave 9 — sessions, agents, approvals, and review

### Task 9.1: Unified session/task model

Map local missions and adapter-native threads into one public session view with provider-native ids stored as provenance. Support new/resume/fork/archive/rename/stop and active/background state.

### Task 9.2: Agent/subagent view

Show hierarchy, objective, status, current action, token/runtime budgets when available, and handoff messages. Do not claim subagent support for adapters that cannot provide it.

### Task 9.3: Approval Inbox

Replace scattered prompts with one approval service/view for filesystem, shell, network, browser, plugin, skill, remote execution, and destructive actions. Consequence text must identify target, scope, duration, and receipt.

### Task 9.4: Review and recovery

Connect diff/test/evidence/time-travel services to a review flow: inspect -> comment -> request change -> approve -> ship/close. Replace native `alert/confirm` with accessible product components.

Exit criteria for Wave 9:

- User can understand all running/blocked work and decide from one inbox.
- Resume/fork/archive behavior is tested across restart where supported.

## 14. Wave 10 — harness expansion

Implement adapters one at a time behind `HarnessAdapterV1`.

Per-adapter mandatory checklist:

1. Official documentation pinned.
2. Executable/protocol detection.
3. Auth state and allowed login/logout paths.
4. Model inventory or truthful unknown state.
5. Start/resume/cancel one session.
6. Stream messages/tool events.
7. Map approvals and errors.
8. Bind project cwd/sandbox.
9. Discover commands/extensions only through documented surfaces.
10. Provider-real Windows receipt.

Order:

- Claude Code
- Gemini CLI
- OpenCode native
- Hermes ACP/TUI gateway
- GitHub Copilot CLI/ACP
- other ForgeOS adapter targets through MCP/ACP/A2A

Do not add 15 logos in one pull request. An adapter that lacks checklist items stays Experimental and hidden from default recommendations.

## 15. Wave 11 — premium visual system

### Task 11.1: Semantic component tokens

Extend tokens for control height, popover elevation, panel radius, dense/comfortable spacing, success/warning/danger surfaces, and theme-specific contrast. Replace page-local hard-coded color/radius values where they violate the semantic system.

### Task 11.2: Accessible primitives

Create reusable:

- button/icon button
- popover/menu/listbox
- dialog/drawer
- tabs/segmented control
- toast/live status
- badge/status
- empty/error/skeleton

Do not introduce a framework rewrite. Use current module/CSS architecture unless an explicit migration is separately approved.

### Task 11.3: Visual density and hierarchy pass

- Compact home hero.
- Reduce nested cards.
- Standardize radii according to hierarchy.
- Raise functional font minimums.
- Make theme/accent apply to every primitive.
- Add scrim/occlusion for sidebar and popovers.

### Task 11.4: Screenshot matrices

Capture home, task, settings, providers, model picker, Skill Hub, Browser, and Studio across:

- obsidian/graphite/snow/paper
- violet/blue/emerald accents
- compact/comfortable density
- 640/768/1024/1440 widths
- empty/loading/error/success/permission states

Review failures manually; pixel snapshots alone do not decide UX quality.

## 16. Wave 12 — verification and release

### Local focused gate

```powershell
node --test tests/ui-v3-*.test.mjs
node --test tests/provider-connections.test.mjs tests/codex-app-server.test.mjs
node --test tests/forgeos-*.test.mjs tests/plugin-*.test.mjs tests/remote-plugin-source.test.mjs
node --test tests/browser-*.test.mjs
npm run validate:ui-tokens
npm run audit:ui-capabilities
npm run build:ui-v3
npm run verify:ui-v3-release
```

Run narrower commands during development; run the complete set only after a slice passes.

### Windows/Electron gate

- Launch source Electron, not only the Node web preview.
- Add/select a real folder.
- Configure or log into a real provider.
- Discover/select a real model.
- Send, stop, resume, and fork a task.
- Exercise file, terminal, browser, skill/plugin, approval, and review flows.
- Capture machine-labelled 8 GB and standard development machine baselines.

### Accessibility gate

- Keyboard-only journey.
- Narrator and NVDA evidence.
- 200% zoom.
- forced-colors.
- reduced motion.
- automated axe-like checks plus manual semantics review.

### Performance budgets

- No whole-page settings rerender for a scalar control change.
- Route interactive target: <= 200 ms warm local, reported by environment.
- No long task > 50 ms during ordinary picker/control interaction without an explicit exception.
- Bounded DOM for large catalogs and settings.
- Idle CPU and memory measurements recorded in NOL-UI-032 receipts.

### Claim gate

Do not claim premium parity or stable release until:

- product-behavior coverage has no unexplained `source_only` P0/P1 records;
- all 5 open Nolane requirements have valid external receipts;
- 15 native external contracts are handled according to their ledger;
- provider-real Windows dogfood passes;
- independent UI review signs the release candidate.

## 17. Review checkpoints

After every wave, produce:

- changed file list;
- behavior IDs closed;
- focused test output;
- browser/Electron journey evidence;
- screenshots for user-visible changes;
- known gaps and external gates;
- rollback instruction;
- next wave entry condition.

Do not regenerate broad release artifacts or commit unrelated dirty files as part of a wave.
