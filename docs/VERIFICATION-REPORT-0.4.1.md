# Forge Studio 0.4.1 verification report

Date: 2026-07-28

## Scope

This report covers the Provider Connection Center, provider readiness preflight, official CLI authentication adapters, direct API providers, secure credential references, lazy provider UI, Windows portable package and signed-update payload.

## Regression suites

The following commands completed successfully on the release tree:

```text
npm test                                      178/178
(cd vendor/forge-os && npm test)              389/389
launcher Go tests                               5/5
native/pty Go tests                             2/2
native/credential Go tests                      1/1
Total                                           575/575
```

`go vet ./...` completed without findings for all three Go modules. `node --check src/app.mjs` completed successfully.

## Runtime smoke

`npm run smoke` started the source runtime on loopback, verified the health endpoint and confirmed that unauthenticated API requests are rejected.

The staged Windows portable application was then started directly from:

```text
release/ForgeStudio-0.4.1-windows-x64/app/src/app.mjs
```

The portable smoke verified:

- health endpoint returned HTTP 200;
- Provider Connection Center markup was present in the staged UI;
- readiness endpoint returned a secret-free provider inventory;
- with no connected provider, creating a run for a valid project returned HTTP 409 with `provider_setup_required` before mission creation.

## Provider security checks

Automated tests verify that:

- direct API keys are stored only through the credential vault backend;
- SQLite provider records contain only a vault alias, not plaintext credentials;
- browser storage is not used for API keys or tokens;
- Codex and Claude authentication use official app-server/CLI commands without token extraction;
- installed but unauthenticated or unhealthy providers are excluded from routing;
- remote custom endpoints require HTTPS;
- keyless OpenAI-compatible endpoints are accepted only when configured on loopback;
- provider errors are redacted before they reach the UI.

## Package integrity

The release build produced:

```text
Portable manifest files:       1,965
Update payload manifest files: 1,961
```

Every file listed by both manifests was read again and matched its declared byte count and SHA-256 digest.

Archive verification:

- Windows portable ZIP: no compressed-data errors;
- update payload ZIP: no compressed-data errors.

Native binary inspection:

- `ForgeStudio.exe`: PE32+ Windows GUI, x86-64;
- `ForgePty.exe`: PE32+ Windows console, x86-64;
- `ForgeCredential.exe`: PE32+ Windows console, x86-64.

## Signed update integration

A temporary Ed25519 release key was generated outside the application package. The actual 0.4.1 update payload was bound to an HTTPS URL, semantic version, minimum launcher version, byte count and SHA-256 digest in a signed manifest.

`UpdateService` verified the signature, downloaded the exact release bytes through the test transport, inspected 1,962 ZIP entries and staged version 0.4.1 successfully. The temporary private key was destroyed after the test and is not part of any artifact.

## Boundaries

The Windows binaries were cross-compiled and structurally inspected in this Linux environment. They were not executed on a physical Windows 11 machine here. Official Codex/Claude login requires the corresponding CLI and completion of its browser or device flow on the user’s machine. The executables are not Authenticode-signed.
