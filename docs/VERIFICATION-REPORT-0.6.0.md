# Forge Studio 0.6.0 Verification Report

Date: 2026-07-28

## Source gates

| Gate | Command | Result |
|---|---|---|
| Forge Studio behavior/regression suite | `npm test` | 254 passed, 0 failed |
| ForgeOS authority suite | `cd vendor/forge-os && npm test` | 389 passed, 0 failed |
| Native launcher tests | `cd launcher && go test ./...` | passed |
| Native ConPTY tests | `cd native/pty && go test ./...` | passed |
| Native credential tests | `cd native/credential && go test ./...` | passed |
| Native static analysis | `go vet ./...` in all three modules | passed |
| Source startup/auth smoke | `npm run smoke` | health 200, loopback binding, unauthenticated access rejected |

The three Go modules contain 13 named test cases in total.

## Functional release gates

Regression coverage includes:

- immutable remote Git/GitHub plugin sources;
- exact-commit and content-addressed cache publication;
- pinned Playwright CLI/Chromium installation with atomic activation;
- per-project MCP/LSP capability review;
- discovery-driven automatic plan patching;
- explicit browser write permission grant/revoke;
- Goal OS persistence, scheduling and recovery;
- mission graph and user-facing activity projection;
- provider readiness and post-failure continuation;
- worktree ownership, leases, fencing and evidence completion;
- Electron isolation, runtime supervision and signed-update rollback.

## Package gates

| Artifact | Result |
|---|---|
| Windows portable runtime smoke | passed from the staged `app` directory |
| Portable manifest | 1,990 files; every byte count and SHA-256 matched |
| Update payload manifest | 1,986 files; every byte count and SHA-256 matched |
| Windows portable ZIP | 1,991 entries; ZIP integrity passed |
| Update payload ZIP | 1,987 entries; ZIP integrity passed |
| `ForgeStudio.exe` | PE32+ Windows GUI x86-64 |
| `ForgePty.exe` | PE32+ Windows console x86-64 |
| `ForgeCredential.exe` | PE32+ Windows console x86-64 |

## Signed update integration

A temporary Ed25519 key pair was generated outside the application package. The actual 0.6.0 update payload was signed with version, minimum launcher version, HTTPS URL, byte count and SHA-256. `UpdateService` verified the signature, downloaded the exact bytes through a bounded fetch, inspected all ZIP entries, and staged the package successfully.

```text
Payload bytes: 7,832,121
SHA-256: 9cc6ed3dc3d21d84f3aacd68211f6e98302a643b75057b9f52529d60d5ad4723
ZIP entries inspected: 1,987
```

## Performance gates

- Source startup remained below the five-second test budget.
- Linux source-runtime RSS remained below the 350,000 KiB test ceiling.
- The eager default UI remained below 100,000 bytes.
- Goal OS and advanced panels, Monaco/xterm, browser runtime and plugin capabilities load on demand.

## Claims boundary

The gates prove the tested source contracts and the integrity of the generated package in this environment. They do not prove:

- execution of the Windows binaries on a physical Windows 11 machine;
- Authenticode reputation or SmartScreen behavior;
- macOS/Linux desktop packaging;
- cloud sandbox or enterprise multi-tenant operation;
- superiority over Codex or Claude Code on independent coding benchmarks.

The complete checklist coverage and remaining gaps are recorded in `ACCEPTANCE-MATRIX-0.6.0.md`.
