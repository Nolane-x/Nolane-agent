# Workspace Skill Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing native and ForgeOS skill catalog discoverable and safely inspectable from a Workspace-level page.

**Architecture:** A small view/controller module owns catalogue state and calls only existing read/preview endpoints. The app router mounts it at `/skills`; a visible Home workspace action exposes the route without expanding the frozen global rail. Styling is a compact catalogue–preview layout using existing semantic tokens.

**Tech Stack:** Vanilla ES modules, Node test runner, existing `ui-v3` token CSS and API client.

## Global Constraints

- Do not install or execute a skill from this surface.
- Keep trust/extension administration in `/control-plane/extensions`.
- Use semantic CSS tokens only; no raw colors or gradients.
- Use labelled controls, real buttons, `aria-pressed`, and explicit loading/error/empty states.
- Build `ui-dist` only after source tests pass; never package Electron locally.

---

### Task 1: Catalogue model and rendering contract

**Files:**

- Create: `ui-v3/views/skills/skills-view.mjs`
- Test: `tests/ui-v3-skills-library.test.mjs`

**Interface:** `createSkillsLibraryController({ api, language })` exposes `snapshot()`, `load()`, `setQuery(query)`, `setCatalog(catalog)`, and `selectSkill(id)`. It consumes bounded `GET /api/skills/catalog?limit=500` and `POST /api/skills/catalog/:id/load`; `renderSkillsLibrary(snapshot)` renders the result.

- [x] Write a failing test that injects catalog entries, searches for “browser”, selects `v2:browser`, asserts only that entry renders, and asserts the preview request is exactly `/api/skills/catalog/v2%3Abrowser/load`.
- [x] Run `node --test tests/ui-v3-skills-library.test.mjs`; module-not-found and contract failures were observed before implementation.
- [x] Implement a local-state controller. Filter title/name/source/maturity text case-insensitively; catalog filter accepts `''`, `native`, `v2`, and `legacy`. Escape every dynamic string in render output. Preserve preview only for the selected returned entry and clear it if filtering hides that entry.
- [x] Extend the test for Vietnamese copy, selection `aria-pressed`, native catalog visibility, runtime error, empty result, and a mismatched returned id.
- [x] Re-run the focused test; pass.
- [ ] Commit: `feat: add workspace skill library view` after all route, styling, and generated release assets are verified.

### Task 2: Route and navigation exposure

**Files:**

- Modify: `ui-v3/core/view-state-bridge.mjs`
- Modify: `ui-v3/app.mjs`
- Modify: `ui-v3/views/home/home-view.mjs`
- Test: `tests/ui-v3-skills-library.test.mjs`

**Interface:** Home renders a `#/skills` workspace action. The app route uses `/^\\/skills(?:\\?.*)?$/` and mounts the Task 1 controller; `GLOBAL_DESTINATIONS` remains unchanged.

- [x] Write failing static route/discoverability assertions for the Home action, unchanged global rail, and route pattern.
- [x] Run `node --test tests/ui-v3-skills-library.test.mjs`; the navigation-contract regression was reproduced before changing the discoverability surface.
- [x] Register the route after Projects. Add a visible Home action without expanding the global rail; mount event listeners for search input, catalog select, and preview buttons; remove listeners on cleanup. Map `/skills` to Workspace in the view-state bridge.
- [x] Run `node --test tests/ui-v3-skills-library.test.mjs tests/ui-v3-accessibility.test.mjs`; pass.
- [ ] Commit with the completed library feature.

### Task 3: Theme-aware responsive page

**Files:**

- Create: `ui-v3/styles/pages/skills.css`
- Modify: `ui-v3/styles/index.css`
- Modify: `ui-v3/styles/responsive.css`
- Generated: `ui-dist/**`
- Test: `tests/ui-v3-skills-library.test.mjs`

**Interface:** `.skills-library__body` is catalogue plus preview on wide screens and a single reading column below 900px. Item selection is encoded by `aria-pressed="true"` and semantic accent tokens.

- [x] Write a failing test that requires `var(--surface-panel)`, `var(--text-primary)`, no raw hex colors, and the narrow `.skills-library__body{grid-template-columns:1fr` rule.
- [x] Run the focused test; the missing stylesheet assertion failed before styling.
- [x] Implement the compact catalogue rail and preview panel using the established spacing, border, text, surface, and accent tokens. No generic hero, raw colors, or decorative gradients were added.
- [x] Run:
  ```powershell
  node --test tests/ui-v3-skills-library.test.mjs tests/ui-v3-accessibility.test.mjs tests/ui-v3-home.test.mjs
  npm run validate:ui-tokens
  npm run build:ui-v3
  npm run verify:ui-v3-release
  npm run audit:ui-quality
  ```
- [ ] Commit the completed feature with generated UI release assets.

## Self-review

Tasks 1–3 cover safe inspection, discoverability, keyboard accessibility, responsive semantic theming, and generated release assets. The plan intentionally has no installation, execution, provider credential, or Electron packaging behavior.
