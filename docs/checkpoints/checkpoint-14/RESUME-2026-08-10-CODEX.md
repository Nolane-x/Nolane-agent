# Nolane Agent — Checkpoint 14 resume note (2026-08-10)

## Scope and handoff

This is a durable continuation checkpoint for the active Nolane Agent goal. The canonical worktree is:

`C:\Users\admin\AppData\Local\Temp\codex-nolane-cp14-019fcba5`

Branch: `cp14-clean-snapshot` (ahead of `origin/cp14-clean-snapshot`; inherited dirty worktree is intentional and must not be reset or cleaned). Electron and packaged smoke were intentionally not built, per the user's instruction to defer them.

## Verified current state

- `npm test`: **2,428 tests passed across 857/857 files**; cached receipts: 857/857.
- `node --test tests/ui-v3*.test.mjs`: **151/151 passed** (including Control Plane, summary, review, and Artifact Dock English/Vietnamese leakage regressions).
- Focused browser/provider/API bundle: **47/47 passed**.
- Changed UI JavaScript passes `node --check`; `git diff --check` has no content errors (only normal CRLF warnings).
- `npm run build:ui-v3`: 119 hashed assets; distribution receipt matched.
- `npm run verify:ui-v3-release`: source-local pass, missing modules 0, accessibility source pass, visual fixtures complete.
- `npm run verify:checkpoint-10-ux-foundation`: pass; settings backend/UI, model profiles, output summary, resizable shell, and responsive accessibility all true.
- `npm run validate:ui-tokens`: undefined variables 0, cycles 0, raw colors outside primitives 0.
- `npm run audit:ui-quality`: 117 files scanned, no accessibility/responsive/offline findings; runtime visual certification remains explicitly unclaimed.
- `npm run audit:ui-capabilities`: 22 capabilities, no duplicate IDs/routes or missing required surfaces.
- `npm run program:nolane`: 198 requirements; 193 verified, 0 not implemented.
- `npm run audit:evidence-freshness`: pass (198/198; stale evidence not accepted).
- `npm run audit:evidence-quality`: pass (198 requirements; no missing or over-concentrated paths).
- `npm run audit:features`: 790 checklist items: 734 `verified_source_test`, 56 `external_gate`, 0 partial, 0 not implemented.
- `npm run audit:runtime-purity`: pass; 8,219 files scanned, no path/content/archive/ownership findings.
- Branding and version coherence audits pass for `Nolane Agent` 5.0.0-beta.6.
- Master acceptance ledger regenerated: 1,460 canonical entries; 1,372 verified, 88 external gates, no implemented-not-wired/not-implemented/unmapped entries.
- Native parity regenerated and verified: 115 contracts, 2,110 candidates, unmatched 0; complete-parity claim intentionally remains false.
- `npm run smoke`: source loopback/auth guard pass (`status: ok`).

## Product changes covered by this checkpoint

- ForgeOS local skill catalog and provenance-aware skill hub with bounded preview/load routes.
- Provider/model truth and discovery paths for Codex, Claude, Gemini, OpenCode, API providers, and OpenAI-compatible endpoints; model identity is preserved as provider + model + deployment key.
- Browser workspace with bounded runtime/tabs/permissions/timeline/screenshot artifact handling; write actions fail closed without a scoped goal permission.
- Codex-like project picker, project-bound composer, localized home command/context menus, settings scroll/focus preservation, Vietnamese/English shell/search/projects/review/workroom copy, and functional Studio tree/editor/diff/preview/save surfaces.
- Control Plane shell, capability atlas, simple expert domains, platform surfaces, and Sovereign Agent Kernel now receive the active language and have explicit English/Vietnamese copy contracts.
- Activity Summary, Review, Mission, and Artifact Dock chrome now follows the active language while retaining source-audit accessibility markers.

## Explicit non-claims and external gates

- ForgeOS upstream verification is intentionally **blocked/fail-closed**: pinned local commit/tree and manifest match, but the vendored snapshot is marked dirty and no remote archive digest is available. Remote `main` at the last check is `354ec4051c3b1693cc63fab89e6b28485232a360`.
- Gemini CLI cannot be runtime-validated because the user's global `C:\Users\admin\.gemini\settings.json` currently fails Gemini's own `hooks.enabled` schema validation. Do not overwrite it without authorization.
- Windows 8-GB performance, screen-reader, external screenshot/visual regression, and production cloud/remote sandbox/PR/CI/OS-keychain/tenant/network gates remain external receipts, not fabricated as local passes.
- Habitat MCP orientation/checkpoint calls were attempted but hit SQLite thread-affinity errors. Source, tests, and local audit scripts are the authoritative fallback for this checkpoint.

## Exact resume sequence

1. Re-read this file and inspect `git status --short --branch`; preserve inherited changes.
2. Re-run `npm run audit:evidence-freshness` after any source/test edit; regenerate `program:nolane` and the master ledger when hashes change.
3. Continue only with remaining in-scope local product/UI gaps or externally supplied receipts. Keep Electron/package builds deferred unless the user explicitly changes that instruction.
4. Before any completion claim, repeat focused UI/provider/browser tests, `npm test`, UI release/token/quality gates, source smoke, and the ForgeOS verification; report all nonclaims explicitly.
