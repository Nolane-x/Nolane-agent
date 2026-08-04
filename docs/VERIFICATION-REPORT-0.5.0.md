# Forge Studio 0.5.0 verification report

Verification date: 2026-07-28.

## Automated suites

- Forge Studio Node tests: 200 passed, 0 failed.
- ForgeOS tests: 389 passed, 0 failed.
- Native Go tests: launcher, PTY helper and credential helper passed.
- `go vet` passed for all three Go modules.
- JavaScript syntax checks passed for the Electron main process, runtime supervisor, UI and recovery coordinator.
- `git diff --check` passed.

## Regressions covered

The release contains tests proving that:

1. A verification failure moves the task out of `review` and records a structured recoverable failure.
2. Retry reconciles legacy tasks stuck in `review` after a failed verification.
3. A follow-up sent after failure recovers the mission and relaunches Autopilot.
4. The UI renders the real safe failure reason instead of a generic red line.
5. Live work exposes provider, target, action, progress time, duration and token usage/estimate.
6. The Electron renderer is sandboxed, context-isolated and has no Node integration.
7. The Electron main process supervises the agent runtime through `utilityProcess` and uses a bounded restart policy.
8. The first-run Electron installer pins version, byte count, HTTPS sources and SHA-256.

## Runtime smoke tests

Source runtime smoke:

```json
{"status":"ok","startup":true,"authGuard":true}
```

Portable dependency-closure smoke was run from:

```text
release/ForgeStudio-0.5.0-electron-windows-x64/app
```

It started the packaged Forge runtime on loopback, returned HTTP 200 from `/health`, rejected an unauthenticated project request with HTTP 401, and accepted the same request with the runtime bearer token.

## Windows artifacts

- `ForgeStudio.exe`: PE32+ Windows GUI x86-64.
- `ForgePty.exe`: PE32+ Windows console x86-64.
- `ForgeCredential.exe`: PE32+ Windows console x86-64.
- Portable manifest entries verified: 1,969.
- Update payload manifest entries verified: 1,965.
- Portable ZIP entries: 1,970.
- Update ZIP entries: 1,966.
- ZIP integrity: no corrupt entries.
- Every staged file matched the manifest byte count and SHA-256.

## Signed update integration

A temporary Ed25519 key pair was generated outside the application package. The actual 0.5.0 update ZIP was signed with a manifest binding version, minimum launcher version, HTTPS URL, byte count and SHA-256. `UpdateService` verified the signature and staged the exact package successfully.

Verified update package:

```text
bytes: 7,775,680
sha256: 302794931a9d08fc8e99e266c28b5b190a921be3601daa04213052a2f357c32e
entries: 1,966
```

The temporary private key was deleted and is not contained in the release.

## Limitations

- The Electron runtime is not embedded in the ZIP. The Windows launcher downloads pinned Electron 43.2.0 on first run and verifies SHA-256 before installation.
- The three Windows binaries were cross-compiled and structurally verified on Linux; this environment cannot execute them on a physical Windows 11 desktop.
- The executables are not Authenticode-signed, so Windows SmartScreen may warn.
- The report proves the implemented contracts and packaging integrity. It does not prove coding-quality superiority over Codex or Claude Code.
