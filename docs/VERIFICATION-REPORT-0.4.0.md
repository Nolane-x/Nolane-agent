# Forge Studio 0.4.0 verification report

Verification date: 2026-07-28

## Source gates

- Forge Studio Node suite: 163 tests, 163 passed, 0 failed.
- Vendored ForgeOS suite: 389 tests, 389 passed, 0 failed.
- Native launcher: 5 tests passed; `go vet ./...` passed.
- Native PTY host: 2 tests passed; `go vet ./...` passed.
- Native credential helper: 1 test passed; `go vet ./...` passed.
- Source runtime smoke: loopback startup, `/health`, bearer rejection and authenticated project API passed.

## User-experience gates

- Default DOM has one primary outcome composer and no raw engineering dashboard.
- Provider, MCP, evidence, vault, terminal and editor controls are absent from the default surface.
- Advanced Workroom is dynamically imported only after the user opens Technical Details.
- All default controls have accessible names.
- Visible keyboard focus and reduced-motion rules are present.
- The eager repository UI shell is below the 100 KB release budget.
- SSE refresh coalescing preserves one active refresh and one queued pass during event bursts.
- Autopilot action classification and hard stops are tested through the application composition root.

## Portable package gates

- Staged application starts from the packaged `app` directory using the complete ForgeOS dependency closure.
- `/health` returned HTTP 200.
- Unauthenticated project API returned HTTP 401.
- Authenticated project API returned a JSON array.
- Windows archive: 1,958 ZIP entries; `zipfile.testzip()` returned no corrupt member.
- Update archive: 1,954 ZIP entries; `zipfile.testzip()` returned no corrupt member.
- Portable manifest: 1,957 files matched declared byte count and SHA-256.
- Update payload manifest: 1,953 files matched declared byte count and SHA-256.
- `ForgeStudio.exe`: PE32+ Windows GUI x86-64.
- `ForgePty.exe`: PE32+ Windows console x86-64.
- `ForgeCredential.exe`: PE32+ Windows console x86-64.

## Signed-update integration

A temporary Ed25519 key pair was generated outside the application package. The actual 0.4.0 update payload was bound to an HTTPS URL, byte count and SHA-256 in a signed manifest. `UpdateService` verified the signature and staged the package successfully:

- signature verified: true;
- staged version: 0.4.0;
- package bytes: 7,746,071;
- inspected ZIP entries: 1,954.

The temporary private key and staged data were deleted after the test.

## Boundaries

- The EXEs were cross-compiled and structurally verified in Linux; this environment cannot execute them on a physical Windows 11 installation.
- The launcher is not Authenticode-signed.
- No production update endpoint or production signing private key is shipped.
- Chromium visual automation is restricted by the build environment, so the release has DOM, API, accessibility, performance and runtime smoke coverage rather than a physical Windows screenshot test.
- These results verify Forge Studio contracts; they do not prove superiority over Claude Code or Codex.
