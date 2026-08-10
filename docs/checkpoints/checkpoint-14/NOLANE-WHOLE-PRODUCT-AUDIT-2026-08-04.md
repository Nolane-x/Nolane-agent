# Nolane Agent whole-product audit — 2026-08-04

Status: evidence-backed planning input, not a release certificate  
Repository: `C:\Users\admin\AppData\Local\Temp\codex-nolane-cp14-019fcba5`  
Branch / inspected HEAD: `cp14-clean-snapshot` / `5a00670`  
Live surface inspected: `http://127.0.0.1:60420/`  

## 1. Executive conclusion

Nolane Agent is not an empty mock. It already contains substantial provider, ForgeOS, plugin, browser, evidence, workroom, credential, model-profile, and control-plane code. The product problem is that the current UI exposes only a small and sometimes misleading fraction of that code. Several controls are visual shells, several selector values are semantically wrong, and the existing audits overvalue source presence while undervaluing end-user behavior.

The next milestone must therefore be a **product-surface convergence**, not another broad backend expansion. Every visible capability must have a complete path:

`discover -> configure -> select -> execute -> observe -> approve -> recover -> verify`

No feature is counted as usable until that path passes a real interaction test.

## 2. Evidence and limitations

### Evidence collected

- Architecture and symbol inspection across `src`, `ui-v3`, tests, requirements, and the vendored ForgeOS 0.6.1 tree.
- Live browser inspection of the running UI.
- Direct reproduction of the settings scroll reset.
- Focused Node test groups for UI, Codex app-server, providers, ForgeOS, plugins, browser, and external-gate logic.
- Current OpenAI Codex documentation for model selection, browser, commands, skills/plugins, and app-server.
- Current primary-source review of Hermes Agent and the user's ForgeOS repository.

### Limits

- This audit does not claim Windows installer certification, provider-real dogfood, WCAG 2.2 AA certification, or 640–1440 visual certification. The project itself records these as external gates.
- The worktree was already heavily modified. No user changes were reset or cleaned.
- The complete `npm test` suite was not used as the primary signal because known Windows SQLite cleanup failures and slow groups obscure focused behavioral evidence.
- Newly installed UI skills become callable only in a later Codex session.

## 3. Runtime findings

| ID | Severity | Finding | Direct evidence | Required result |
|---|---:|---|---|---|
| NPA-001 | P0 | Settings jumps to the top after changing a control. | At `scrollTop=4200`, clicking the multiline-paste switch changed `.settings-content.scrollTop` to `0`. `ui-v3/app.mjs:318-323` replaces the entire settings root on every click/input/change. | Preserve section, nested scroll, focus, selection, and open popovers; preferably update only the affected control/state region. |
| NPA-002 | P0 | Model picker selects a provider id instead of a model deployment. | `ui-v3/views/home/home-view.mjs:45` resolves `providerId` before `modelId`; `:88` posts it as `planningProviderId` and has no `planningModelId`. Multiple models from one provider collapse to one value. | Select an exact deployment key containing provider/account/endpoint/model, and send provider plus model separately. |
| NPA-003 | P0 | `/` and `@` are string insertion, not a structured command/context system. | `ui-v3/app.mjs:246` inserts `/${id}` or `@kind:id`; `:254` inlines small files as XML-like prompt text; submit never resolves these tokens or populates `mcpAllowedTools`. | Store typed `CommandInvocation` and `ContextReference` objects; resolve, authorize, render as chips, and serialize explicitly. |
| NPA-004 | P0 | Provider setup backend exists, but API/account setup is not exposed as a coherent user flow. | `src/server/routes.mjs:1671-1695` provides configure, test, login, logout, and cancel. `:1937-1950` provides credential references. Settings has no complete provider setup wizard. | Account & Providers center with API forms, official login flows, test results, model sync, reauth, logout, and safe credential references. |
| NPA-005 | P0 | CLI model discovery is not implemented. | `ProviderConnectionService.discoverModels()` only accepts API kinds. Built-in CLI profiles become `cli-selected`; `CliProvider.detect()` only proves executable/version. | Adapter-specific model inventory with provenance; never invent static lists when a harness cannot enumerate models. |
| NPA-006 | P0 | Codex app-server integration does not use its documented `model/list` surface. | Local client handles auth/thread flow, but UI still creates a `cli-selected` placeholder. Current app-server documents `model/list` with reasoning efforts, modalities, hidden/default fields. | Initialize once, call `model/list`, cache with freshness, render model/effort controls, and pass selected values to `thread/start` / `turn/start`. |
| NPA-007 | P1 | Only Claude has a generic CLI auth adapter. | `src/app.mjs:415-425` registers `CliAuthAdapter` only for `claude`; Codex delegates to app-server. Gemini and OpenCode have no equivalent account action. | Capability-driven auth adapters with explicit support states and documented constraints per harness. |
| NPA-008 | P1 | Workroom/Studio is largely a visual placeholder. | `ui-v3/views/workroom/workroom-view.mjs` says “Editor host is ready” and renders file, terminal, layout, and agent buttons without complete action wiring. | Real project-bound file tree, editor/read view, diff, terminal, agent event stream, and review handoff. |
| NPA-009 | P1 | Browser runtime is powerful but product-invisible. | `BrowserAgentService` supports project-isolated persistent sessions, open/goto/snapshot/find/click/fill/type/press/tabs/screenshot/journey/status/close. No first-class Browser workspace exposes progress, session, approvals, screenshots, console/network evidence, or artifacts. | Shared browser workspace with live state, action timeline, permissions, evidence, and a separate-profile security model. |
| NPA-010 | P1 | Plugin marketplace backend is real but appears mostly as a raw control plane. | Plugin service supports remote Git sources, immutable cache, trust verification, transparency log, per-project activation, quarantine, MCP/LSP review, and bounded context. | Product-grade Extensions / Skill Hub with browse, detail, trust, install, review, activate, update, rollback, and source management. |
| NPA-011 | P1 | ForgeOS integration is deep internally but shallow at the product route. | Bridge/gateway tests prove routing, bounded context, evidence, approvals, scans, and remote sandbox rules. Product routes expose only `/status`, `/lanes`, and `/sandbox`. | Stable Nolane-facing ForgeOS facade for skill search/inspect/route, context packs, evidence, federation state, approvals, and maturity labels. |
| NPA-012 | P1 | “426 backend routes” are rendered as an atlas, not converted into workflows. | `ui-v3/generated/backend-atlas.mjs` and `live-domain-workspace.mjs` can enumerate/render raw responses. Route existence is not usability. | Capability coverage ledger must bind each product promise to journey tests, not just a source route. |
| NPA-013 | P1 | Current UI tests miss the two reproduced P0 defects. | 11 focused UI tests passed while model selection and settings scroll were still broken. | Add browser-level behavioral contracts and negative tests; forbid source-string-only completion for interactive features. |
| NPA-014 | P1 | Project creation is desktop-only and the non-Electron preview cannot exercise it. | `ui-v3/app.mjs:147-165` requires `nolaneDesktop.selectDirectory`; Electron IPC safely implements folder selection. | Keep Electron as production path; add a clearly labelled development fixture/injected directory picker for UI smoke tests only. |
| NPA-015 | P1 | Project identity is not consistently carried through every surface. | Home has a picker; workroom route uses a first/default project in places; command/context and sessions do not share one canonical project context. | Introduce one `WorkspaceContext` store consumed by chat, model, files, browser, terminal, memory, skills, and activity. |
| NPA-016 | P1 | Error reporting collapses into `internal-error`. | User-observed send failures provide no actionable provider, RPC, stderr, retry, or correlation information. | Typed error envelope, compact user summary, expandable diagnostics, retry/reauth/open-settings actions, and copyable correlation id. |
| NPA-017 | P1 | Global theme tokens exist, but component compliance is not enforced. | Token system supports theme/accent/radius, but a large set of one-line page CSS rules and native selects produce inconsistent styling and hard-to-review overrides. | Token conformance test, custom accessible popovers/selectors, semantic radii, and screenshot matrices per theme/density. |
| NPA-018 | P2 | Giant hero and empty space weaken a desktop agent workflow. | Home prioritizes a large generic hero over project state, task history, diffs, terminal, browser, and approvals. | Compact task cockpit: project/context first, recent work and blockers visible, composer remains primary. |
| NPA-019 | P2 | Native `alert()` and `confirm()` break product consistency and evidence. | Project and time-travel flows use browser dialogs in `ui-v3/app.mjs`. | Shared modal/toast/approval components with keyboard, focus trap, consequence copy, and receipts. |
| NPA-020 | P2 | Settings is a 15,000+ px page at the inspected state. | Live `.settings-content.scrollHeight` was about 15,246–15,452 px. | Render one category or virtualized search results; sticky local header; stable category URL and back/forward state. |
| NPA-021 | P2 | Responsive certification remains open and the 640 px boundary is fragile. | The project checkpoint explicitly keeps NOL-UI-031 external. Source uses a `max-width:639px` compact breakpoint, leaving exactly 640 px in the two-column regime. | Define named layout modes and test exact 640, 768, 900, 1024, 1280, 1440 widths. |
| NPA-022 | P2 | Provider test files fail cleanup on Windows. | `tests/provider-connections.test.mjs`: 5/5 assertions reached cleanup failures with SQLite `EBUSY` unlink errors. | Close databases/handles deterministically before temp cleanup; separate assertion failure from cleanup failure. |
| NPA-023 | P2 | The UI maturity ledger is overoptimistic. | `ui-v3-master-plan-gap-registry.json` reports no partial/missing UI gaps, while direct interaction found multiple P0/P1 behavior gaps. | Replace binary file/source checks with journey, state, accessibility, and external-evidence dimensions. |
| NPA-024 | P2 | ForgeOS provenance metadata may be stale. | Vendored `vendor/forge-os/package.json` is 0.6.1 but repository URL points to `forgeos/forge-os`, while the user-designated upstream is `Nolane-x/forge-os`. | Pin upstream URL, commit SHA, license, sync date, compatibility matrix, and verification receipt. Do not silently overwrite until provenance is verified. |

## 4. Capability exposure matrix

| Capability | Backend reality | UI reality now | Product decision |
|---|---|---|---|
| API providers | Configure/test/delete with vault refs | No complete credential/setup flow | Build Provider Center first. |
| Codex account | App-server account/login/cancel/logout | Status/model placeholder; failures opaque | Use app-server as the canonical Codex integration. |
| Claude account | Fixed-command auth adapter | No coherent login/reauth experience | Surface only documented adapter actions. |
| Gemini/OpenCode account | CLI execution registered | Auth status/control incomplete | Add only after adapter contracts and real tests. |
| Model profiles | Discovery/probes/truth/dossiers exist | Picker collapses model to provider | Split inventory truth from selection state. |
| Projects | Store/API and Electron folder picker exist | Main picker improved; preview limitations and cross-surface drift remain | Canonical workspace context. |
| Commands | Command API exists | Menu inserts text tokens | Build command registry and dispatcher. |
| MCP/tools | Tool list/gateway exists | `@tool` does not authorize or bind tool | Typed tool context + approval. |
| Files | Workroom file read/write/diff APIs exist | Placeholder Studio; attach inlines text | Typed file references and real workroom. |
| Browser | Governed project-isolated runtime exists | No shared browser surface | Browser workspace after provider/composer foundation. |
| Plugins | Trust-aware install/activate backend exists | Raw control-plane exposure | Extensions UI plus Skill Hub. |
| Skills | ForgeOS and plugin skill materialization exist | No first-class catalog | Nolane Skill Registry facade, not a duplicate engine. |
| ForgeOS | Bridge/gateway with real tests | Three shallow status endpoints | Deep facade with truthful maturity/evidence. |
| Evidence/gates | Many ledgers and receipts exist | Hard to understand; count ambiguity | One Gate & Evidence Center with ledger provenance. |
| Sessions/agents | Runtime primitives and app-server concepts exist | Sidebar does not yet communicate full thread/run state | Unified session/activity model. |

## 5. Gate taxonomy — do not combine these numbers

The user's “63 external” recollection is valid for the historical 3.5 audit, but it is not the current release-gate count.

| Ledger | Scope | Count/status |
|---|---|---|
| `docs/feature-audit-3.5.0.json` | Historical broad feature frontier | 1,028 verified, 59 partial, 63 external gates |
| `docs/feature-audit-5.0.0-beta.6.json` | Reduced current feature audit | 193 verified, 5 external gates |
| `requirements/nolane-native-wave-checkpoint.json` | Native waves 16–19 certification | 15 external contracts, 1,237 external paths, 5 open Nolane requirements |

The five current Nolane requirements are provider-real Windows dogfood, Windows 8 GB performance/visual baseline, WCAG 2.2 AA, responsive 640–1440+, and UI performance/visual budgets. The product must show the ledger name, version, environment, evidence age, and claim boundary beside any count.

## 6. Test evidence collected in this audit

| Group | Result | Meaning |
|---|---|---|
| UI home/model/settings | 11 pass, 0 fail | Existing unit/source-level contracts pass but do not cover the reproduced interaction defects. |
| Codex app-server | 4 pass, 0 fail when rerun alone | Sandbox shapes, completion, governed actions, and account RPCs work in the fixture. A parallel run had one transient initialize timeout. |
| ForgeOS + plugins | 22 pass, 0 fail | Bridge, gateway, routing, bounded context, evidence, approvals, quarantine, remote source, and capability review contracts pass. |
| Browser + external checkpoint | 8 pass, 0 fail | Browser isolation/safety/gateway and fail-closed external checkpoint contracts pass. |
| Provider connections | 0 pass, 5 fail at cleanup | All reported failures were Windows SQLite `EBUSY` unlink errors; test cleanup is not trustworthy enough to certify assertions. |

## 7. Product principles derived from the audit

1. **Behavior over presence.** A route, button, or test string is not a feature.
2. **Exact selection.** Project, account, endpoint, provider, model, skill, tool, and file references use stable typed IDs.
3. **Truth at the point of choice.** Show source, freshness, auth state, capability, maturity, and limitation where users select something.
4. **Progressive disclosure, not hidden power.** Everyday mode is simpler; it does not erase auditability or make fake claims.
5. **No secret scraping.** Use official OAuth/CLI/app-server flows and credential references. Never import passwords or raw cookies through the Nolane UI.
6. **One workspace context.** Chat, files, browser, terminal, memory, skills, evidence, and agents work against the same selected project.
7. **Reversible operations.** Install, activation, model change, browser permission, and file mutation expose review, rollback, and receipts.
8. **ForgeOS is a substrate.** Nolane consumes ForgeOS routing, context, trust, federation, and evidence through a pinned facade instead of reimplementing them.

## 8. Release claim boundary

This audit supports planning and identifies real capabilities and real gaps. It does not authorize claims of Codex parity, Hermes parity, production-grade browser automation, universal CLI compatibility, certified skills, WCAG conformance, or Nolane 5.0 readiness. Those claims require the external evidence recorded in the project checkpoint and the journey tests specified in the companion plan.
