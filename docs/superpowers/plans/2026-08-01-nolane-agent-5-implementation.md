# Nolane Agent 5.0 Implementation Plan

> **For agentic workers:** execute one acceptance requirement at a time with test-first development. Never promote multiple generic requirements from one broad test.

**Goal:** Reach a reproducible Nolane Agent stable release with zero `not_implemented` requirements except explicitly justified external gates.

**Architecture:** Product identity, UI v3, proof-driven acceptance and NolaneNative clean transformation are independent workstreams joined by the release matrix. Each workstream has its own entrypoints and gates.

**Tech stack:** Node.js ESM, Electron, HTML/CSS/JavaScript, existing ForgeOS compatibility layer, local ZIP inspection, Node test runner.

## Global constraints

- Preserve historical receipt bytes and legacy evidence verification.
- Keep NolaneNative reference license and attribution.
- Do not import NolaneNative Python modules into Nolane production paths.
- Do not mark interfaces or fixtures as verified runtime behavior.
- Keep source releases Gitless and clean-room reproducible.
- Keep UI v2 available only as an explicit migration fallback until v3 release gates pass.

## Phase 1 — Identity and proof foundation

- [x] Add canonical product identity and package version.
- [x] Add named requirement acceptance registry.
- [x] Add file-level NolaneNative transformation ledger.
- [ ] Add product-surface leakage scanner and explicit migration allowlist.
- [ ] Migrate executable, CLI, SDK, HTTP and VS Code public names.
- [ ] Add clean-room acceptance replay for the exact alpha ZIP.

## Phase 2 — Workspace UI

- [x] Add deterministic UI v3 build and fail-closed root resolver.
- [x] Build AppShell and lazy router.
- [x] Build Session Sidebar state model.
- [x] Build Home and Mission Composer.
- [x] Build incremental Mission state and attention cards.
- [ ] Build Artifact Dock.
- [ ] Build Review and Ship.
- [ ] Build Workroom.
- [ ] Build Projects, Settings and Review Queue.
- [ ] Complete accessibility, responsive, visual and performance gates.

## Phase 3 — Control Plane

- [ ] Build the Control Plane shell.
- [ ] Migrate all technical centers into domain routes.
- [ ] Add deep links back to mission evidence.
- [ ] Ensure route-level lazy loading and resource suspension.

## Phase 4 — NolaneNative clean transformation

- [x] Inventory all archive entries and preserve provenance.
- [ ] Reimplement native agent loop and state lifecycle.
- [ ] Reimplement provider resolution and adapters.
- [ ] Reimplement tools, sessions, memory, gateways, cron, plugins and media.
- [ ] Add differential acceptance tests without importing upstream runtime code.
- [ ] Retire the archive only after all replacement gates pass.

## Phase 5 — Proof and intelligence

- [ ] Wire quarantine through every untrusted content ingress.
- [ ] Add Gitless discovery and precise HTTP boundary semantics.
- [ ] Separate smoke, coding and competitor benchmark lanes.
- [ ] Implement verifier mesh, trajectory lab and held-out promotion.
- [ ] Implement small-model research programs only after instrumentation gates pass.

## Release completion

- [ ] Full Node, Go, Python, VS Code and ForgeOS matrix passes.
- [ ] Exact source ZIP passes clean-room replay without `.git`.
- [ ] Windows and update artifacts carry Nolane identity and required components.
- [ ] Acceptance ledger contains no unexplained `not_implemented` or `implemented_not_wired` items.
- [ ] Independent benchmark claims remain disabled unless external attestation exists.
