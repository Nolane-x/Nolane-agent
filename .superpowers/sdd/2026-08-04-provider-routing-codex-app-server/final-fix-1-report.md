# Final review fix wave 1 report

Date: 2026-08-04
Scope: production UI parity, Codex sandbox contract documentation, and malformed legacy provider-key boundary.

## Result

- The committed production UI overlay is generated from a canonical-LF clean `HEAD` snapshot, not from the unrelated dirty UI worktree.
- The production manifest now maps `views/home/home-view.mjs` to `home-view.74f3017bf8f0.mjs`; the served module prefers `providerId` and its file receipt matches.
- The adaptive router accepts exact registered IDs and well-formed legacy `provider/model` keys, but leaves `codex/` on the existing unknown-provider diagnostic path.
- The design and plan now distinguish `thread/start.params.sandbox: 'read-only'` from `turn/start.params.sandboxPolicy: { type: 'readOnly' }`.
- The already-correct Codex App Server adapter was not changed.

## TDD evidence

RED, run in a clean exported `a22043a` snapshot after adding only the new tests:

```powershell
node --test tests/adaptive-router.test.mjs tests/ui-v3-root-switch.test.mjs
```

Result: 10 tests, 8 passed, 2 failed as intended.

- `AdaptiveProviderRouter does not treat an empty model-profile suffix as a legacy key`: missing expected `Unknown provider: codex/` exception.
- `production root serves a receipt-bound home module that submits registered provider IDs`: served HTML contained `value="codex/cli-selected"` instead of `value="codex"`.

GREEN, after the minimal router fix and clean UI build:

```powershell
node --test tests/adaptive-router.test.mjs tests/ui-v3-root-switch.test.mjs
```

Result: 10 tests, 10 passed, 0 failed.

## Exact staged-tree verification

The staged index was written to tree `d923a8e6f22b859d52d52ff04de19615afdf1048`, exported with `core.autocrlf=false`, and tested independently of the dirty worktree.

```powershell
node --test tests/adaptive-router.test.mjs tests/ui-v3-root-switch.test.mjs tests/codex-app-server.test.mjs
```

Result: 14 tests, 14 passed, 0 failed.

```powershell
node --test tests/ui-v3-module-build.test.mjs tests/ui-v3-stable-entry.test.mjs
```

Result: 2 tests, 2 passed, 0 failed.

```powershell
node --input-type=module -e "import { verifyUiV3Release } from './scripts/verify-ui-v3-release.mjs'; const report = await verifyUiV3Release({ root: process.cwd(), write: false }); console.log(JSON.stringify({ sourceLocalPass: report.sourceLocalPass, distributionReceiptMatched: report.distributionReceiptMatched, manifestReceiptSha256: report.manifestReceiptSha256 })); if (!report.sourceLocalPass || !report.distributionReceiptMatched) process.exit(1);"
```

Result: `sourceLocalPass=true`, `distributionReceiptMatched=true`, manifest receipt `bd7e821a9778dbbd96053fc67ab115ca0ab0493dbff691298b8293612a7bca40`.

Clean build result: 111 files; manifest receipt `bd7e821a9778dbbd96053fc67ab115ca0ab0493dbff691298b8293612a7bca40`; release receipt `39b0a7c15cbb02c9757770bd05b55b39537d575773a94773a0928e0c995f6645`.

## Bundle overlay

The clean build differs from the prior committed `ui-dist` in four logical files only:

- modify `ui-dist/app.56f6772cdb13.mjs` (rewritten home-module import)
- modify `ui-dist/manifest.json`
- modify `ui-dist/source-release.json`
- rename `ui-dist/views/home/home-view.8a4331eed63b.mjs` to `ui-dist/views/home/home-view.74f3017bf8f0.mjs` with the provider-ID preference

These generated blobs were staged directly from the clean snapshot. The unrelated current `ui-dist` working files were not staged.

## Bounded checks and exclusions

- `git diff --cached --check`: passed before report staging; rerun immediately before commit.
- A broader `ui-v3-home` / provider-registry / HTTP UI group was attempted twice with a 124-second bound and timed out without output. It is not counted as passing evidence.
- The full suite was not run, per the final-fix brief; no unrelated full-suite issue is claimed fixed.
- The exact commit hash is reported in the handoff because a commit cannot contain its own hash.
