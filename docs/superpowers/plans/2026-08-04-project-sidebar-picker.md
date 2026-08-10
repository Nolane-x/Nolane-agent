# Project sidebar and picker implementation plan

> **Execution note:** This plan is executed inline in the current workspace after the user approved the design.

## Goal

Make the live UI project-aware and Codex-like without introducing a second project backend: add a reusable project picker, native-folder project creation, a functional collapsible sidebar, and an opaque theme-aware experience popup.

## Scope and invariants

- Reuse `GET /api/projects`, `POST /api/projects`, and `window.nolaneDesktop.selectDirectory()`.
- Keep the selected project ID as the source of truth for `/api/missions/plan`.
- Do not copy or move user folders; do not accept arbitrary filesystem paths from HTML.
- Keep the existing session/mission store and language behavior intact.
- Use semantic CSS variables for every new surface, border, text, and accent.
- Preserve the unrelated pre-existing worktree changes and generated UI distribution output.

## Bite-sized TDD tasks

1. Add project-picker model/render tests: sort/filter projects, select active project, expose create/no-project actions, and render localized labels.
2. Add sidebar tests: render project section and localized actions; verify collapse state is represented in the shell model and layout persistence.
3. Add overlay regression test: experience popup has a dedicated stacking layer and opaque theme surface; no transparent color-mix background remains.
4. Implement `project-picker.mjs` as a small pure model plus HTML renderer.
5. Extend `layout-store` and `app-shell` with persisted `sidebarCollapsed` state and a visible reopen trigger.
6. Add project data to the session sidebar, wire picker interactions, and connect native folder creation to `POST /api/projects` with refresh/select behavior.
7. Replace the home native project `<select>` with the shared picker while retaining a hidden `projectId` form control and existing mission submit contract.
8. Apply overlay z-index/isolation/opaque background and theme-token rounded styling; add responsive drawer behavior without hard-coded colors.
9. Run focused UI tests, build `ui-v3`, run the release verifier, and inspect the live portal after a clean source-server reload.

## Verification commands

```powershell
node --test tests/ui-v3-project-switcher.test.mjs tests/experience-switcher.test.mjs tests/ui-v3-home.test.mjs tests/ui-v3-resizable-shell.test.mjs
npm run build:ui-v3
npm run verify:ui-v3-release
```

The full suite remains a separate signal; known Windows cleanup/receipt baselines must not be silently relabeled as caused by this UI work.
