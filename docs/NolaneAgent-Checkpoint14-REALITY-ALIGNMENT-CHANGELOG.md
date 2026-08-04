# Nolane Agent Checkpoint 14 — Reality Alignment Changelog

**Baseline source:** Checkpoint 13 commit `72f35b57aa32299bb4369eb84759c489b03ce697`  
**Revision date:** 2026-08-03

This note records the major corrections applied across the three Checkpoint 14 planning documents.

## 1. Source identity and architecture drift

- Added a mandatory workstream to update the stale Wave 6 `README.md` and Forge Studio-labelled architecture document.
- Explicitly documented the current ForgeOS compatibility/authority substrate and prohibited documentation-only removal.
- Kept NolaneNative excluded from production runtime while retaining historical notices and evidence.

## 2. Runtime composition and route architecture

- Recorded `src/app.mjs` as the approximately 1,311-line composition root.
- Recorded `src/server/routes.mjs` as the approximately 1,990-line centralized router.
- Replaced any implied rewrite with behavior-preserving domain extraction and compatibility facades.
- Added route-inventory, dependency-graph, startup, and retention gates.

## 3. UI source/build/fallback contract

- Defined `ui-v3` as editable progressive source.
- Defined `ui-dist` as generated, receipt-checked production output.
- Defined `ui` as compatibility/recovery fallback until parity and retirement gates pass.
- Added UI convergence and no-hand-edit rules.

## 4. Experience switching

- Replaced the current cyclic-only experience pill target with a direct any-to-any switcher.
- Made user-layer Settings authoritative; `localStorage` is only a bounded cache.
- Added state-preservation contracts for route, conversation, mission, project, draft, attachments, files, approvals, and running processes.

## 5. Model intelligence

- Corrected the plan from “create Model Profile v2” to convergence of the three existing layers:
  - `src/model-profiles/*`
  - `src/providers/model-profile-registry.mjs`
  - `src/model-management/*`
- Added a schema-naming ADR because `nolane.model-profiles.v2` is already used by a compatibility API.
- Separated base model, snapshot, deployment, and local artifact.
- Added durable discovery, field provenance, freshness, conflict, eval, runtime observation, harness recommendation, and UI explanation contracts.

## 6. Personalization

- Kept `SettingsService` and its `Defaults < User < Project < Local` layering as the only value source of truth.
- Reframed Personalization Profile as a deterministic projection plus provenance/history metadata ledger.
- Removed the need for a second preference database.
- Corrected planned enum values to the actual Settings catalog values.
- Added bounded runtime consumption and explicit non-escalation rules.

## 7. Updater and release trust

- Corrected the source claim: `config/update.example.json` is source-controlled; `config/update.json` and the public-key file are release-generated.
- Retained the existing signed Nolane manifest and Electron IPC trust boundary.
- Added the missing desktop coordinator, scheduled checks, streaming staging, unified `ui-v3` update UX, explicit NSIS relaunch, migration, snapshot, recovery, and post-update health requirements.
- Kept real Windows CP13 → CP14 update replay as a Checkpoint 14 exit gate.

## 8. Evidence and certification language

- Separated route/UI/schema/test presence from real capability certification.
- Separated CP14-scoped external gates from historical whole-program gate counts.
- Required source, mock, live-provider, local-hardware, Windows, and external certification scopes to be reported independently.
