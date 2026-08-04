# Checkpoint 13 — Implementation Plan

## Phase 1 — Baseline and retention

- Preserve the Checkpoint 12 source as the recovery baseline.
- Inventory global routes, settings fields, Control Plane domains, backend routes and Recovery UI.
- Add regression gates that fail when a retained contract disappears.

## Phase 2 — Progressive shell

- Add `everyday`, `workspace`, `studio` and `expert` policies.
- Preserve `standard` and `research` aliases for migration and automation.
- Redesign the global rail, session sidebar, top bar and experience switcher.
- Keep historical destination IDs stable.

## Phase 3 — Everyday composer

- Replace the mission-only landing page with a consumer-grade chat surface.
- Load projects, missions, providers, model profiles, tools and commands from real APIs.
- Implement attachments, `@` mentions, `/` commands, intent and model routing controls.
- Submit missions through the real planning API.

## Phase 4 — Workspace observability

- Add selected-mission summary, task progress and typed event filters.
- Make activity links open Review and Studio.
- Show only events supported by runtime evidence; keep system policy noise behind a dedicated filter.

## Phase 5 — Studio and expert surfaces

- Redesign Workroom as a focused three-pane Studio.
- Generate the Capability Atlas directly from `src/server/routes.mjs`.
- Keep the historical 13 approved Control Plane domains and add the atlas as a compatibility-safe expert surface.
- Fix dynamic navigation through path-scoped router caching.

## Phase 6 — Settings, i18n and themes

- Expand to 18 groups and at least 84 retained fields.
- Add English/Vietnamese switching and localized operational copy.
- Add Nocturne, Obsidian, Graphite, Aurora, Snow, Paper and System themes.
- Add six accents, density, motion, zoom, code font and accessibility controls.
- Preserve the active language/theme when an unrelated setting changes.

## Phase 7 — Verification

- Build the hashed production renderer and stable `index.html` entry.
- Run targeted UI/settings tests, token validation, capability audit, source release verification and static quality audit.
- Open production code through the authenticated runtime and audit every main route.
- Capture representative layers, themes, languages, menus and responsive sizes.
- Run the complete repository test suite before packaging.

## Release blockers

- Any blank production route.
- Any console error or HTTP 4xx/5xx during route audit.
- Missing legacy navigation/settings/recovery contract.
- A Control Plane link that changes URL without changing content.
- Missing stable production entry.
- Token validation failure.
- Full test suite failure.
