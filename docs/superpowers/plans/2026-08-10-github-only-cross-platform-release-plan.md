# GitHub-only cross-platform Electron release plan

Date: 2026-08-10  
Status: design-ready; do not trigger a public release until every required signing secret and platform gate is present.

## Objective

Publish Nolane Agent exclusively from GitHub Actions as a single, attested GitHub Release containing native Windows, macOS, and Linux installers. Existing installed applications must discover only a signed update that matches their operating system and install mechanism. A missing signing credential is a release blocker, never a reason to publish an unsigned-looking asset.

## Current truth

- `.github/workflows/release.yml` is a Windows-only NSIS release pipeline.
- `electron-builder.config.cjs` currently declares only the Windows `nsis` target.
- `src/update/update-service.mjs` and `desktop/update-controller.cjs` intentionally accept only signed `nolane.agent.update.v2` NSIS installers. This is safe for Windows, but it is **not** a macOS or Linux updater.
- Source-runtime and browser evidence run on GitHub; no Electron package is built on a developer machine for this program.

Do not label macOS or Linux as self-updating until the platform-specific update path below is implemented and exercised on its own hosted runner.

## Release contract

| Platform | Artifact | Required signing / trust | Update contract |
| --- | --- | --- | --- |
| Windows x64 | NSIS `.exe`, `.blockmap`, channel YAML | Authenticode certificate and publisher identity | Existing signed v2 NSIS path, then migrate to v3 platform envelope |
| macOS universal (or x64 + arm64 while universal is unavailable) | `.dmg` and `.zip` | Developer ID signing, hardened runtime, notarization and stapling | `electron-updater` GitHub provider; installer must be notarized before publication |
| Linux x64 | AppImage plus `.deb` | SHA-256 + GitHub attestation; optional GPG provenance | AppImage only when launched as an AppImage; DEB reports package-manager ownership and never self-replaces |

Every release also includes: `SHA256SUMS.txt`, SLSA/GitHub attestations, full release matrix receipts, a signed per-channel manifest, and release notes generated from the immutable tag.

## Architecture decisions

1. Retain the custom signed manifest as the admission boundary. Do not trust an unverified electron-builder feed merely because it is hosted on GitHub.
2. Introduce `nolane.agent.update.v3`, with `platform`, `arch`, `package.kind`, `package.name`, and an explicit install strategy. The signature covers all of those fields and the immutable tag/commit.
3. Split installation controllers by strategy:
   - `nsis` keeps the existing verified Windows launch path.
   - `electron-updater` is allowed only for a signed/notarized macOS zip and a running AppImage; it receives an already admitted version/feed and never exposes raw URLs to the renderer.
   - `package-manager` is informative only; it opens release notes or reports the package-manager command without writing binaries.
4. Keep the renderer API unchanged (`check`, `download`, `installAndRestart`) but return an honest `unsupported-on-this-installation` state when a strategy is unavailable.
5. A macOS DMG is a distribution installer, not an in-place updater. It must not be selected as a self-update package.

## Required repository changes

### 1. Package configuration and build entry points

Modify `electron-builder.config.cjs` and add narrow build scripts:

- `build:electron:windows-installer` — Windows runner only, NSIS x64.
- `build:electron:macos` — macOS runner, universal DMG + zip, hardened runtime and notarization enabled.
- `build:electron:linux` — Ubuntu runner, AppImage + deb x64.

The configuration must use explicit artifact names that include platform and architecture. Do not reuse the Windows `NolaneAgent-Setup-…exe` pattern for other platforms.

### 2. Signed update v3

Modify these in one vertical slice with negative tests first:

- `scripts/update-release-tools.mjs`
- `src/update/github-release-policy.mjs`
- `src/update/update-service.mjs`
- `desktop/update-controller.cjs` or small platform-specific controller modules
- `desktop/update-coordinator.cjs`

Acceptance cases:

- A Windows process rejects a macOS/Linux manifest even when it has a valid signature.
- A macOS process accepts only an admitted notarized zip feed; it does not execute a DMG from the data directory.
- Linux accepts the AppImage strategy only when `APPIMAGE` identifies a writable running image; Debian/RPM installs stay package-manager owned.
- Asset name, GitHub repository, tag, commit, SHA-256, byte count, platform, arch, and install strategy are all signed and checked.
- The renderer cannot select paths, arguments, or raw updater URLs.

### 3. GitHub workflow topology

Replace the single `windows-release` job with these dependencies:

```text
validate-tag-and-source
  ├─ build-windows-nsis
  ├─ build-macos-notarized
  └─ build-linux-appimage-deb
        └─ assemble-signed-manifests-and-checksums
              └─ attest-assets
                    └─ create-or-update-github-release
                          └─ advance-channel-feed
```

`assemble-signed-manifests-and-checksums` downloads immutable artifacts from the three jobs and is the only job granted `contents: write`. Build jobs receive only `contents: read`; no signing secret is made available to a job that does not need it.

Use a tag-only trigger plus a manual dispatch that requires an existing immutable tag. The manual dispatch must take a `publish` boolean defaulting to `false`, so a rehearsed run can upload private workflow artifacts but cannot create a GitHub Release or update the feed.

### 4. Required GitHub configuration before publication

- `NOLANE_UPDATE_PRIVATE_KEY_B64` — Ed25519 update manifest signing key.
- `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD`, and `NOLANE_WINDOWS_PUBLISHER` — Authenticode signing.
- `MAC_CSC_LINK`, `MAC_CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID` — Developer ID signing and notarization.
- Protected release environment with required reviewer; repository tag protection; `contents: write` scoped to the assembly job only.

The workflow checks each required secret before artifact construction and fails closed with a non-sensitive message. It never prints certificate values, private keys, API credentials, or raw manifests containing secrets.

## Test and evidence plan

Add focused tests before each implementation change:

- `tests/electron-installer-config.test.mjs`: all targets, exact artifact names, notarization configuration, no source runtime omitted.
- `tests/update-service.test.mjs`: signed v3 matrix and platform/architecture mismatch negatives.
- `tests/electron-update-controller.test.mjs`: NSIS, macOS updater handoff, AppImage eligibility, package-manager refusal, path/argument injection negatives.
- `tests/github-release-workflow.test.mjs`: least privilege, all three runners, prerequisite secrets, private rehearsal, attestations, no local Electron requirement.
- workflow receipts: uploaded file inventory, SHA-256 file, signed manifests, attestation references, and redacted runner/platform labels.

Hosted runner evidence must include one build/install journey per platform. It does not certify a third-party provider or a user’s personal Mac/Windows machine; those remain explicitly scoped external evidence.

## Rollout order

1. Land update v3 contracts and tests without changing release publishing.
2. Land cross-platform package configuration and non-publishing GitHub rehearsal workflow.
3. Provision/review all signing secrets and run one internal prerelease tag.
4. Verify installed Windows NSIS update, notarized macOS update, AppImage update, and Debian ownership behavior using receipts.
5. Enable `publish=true` for prerelease tags only.
6. Promote to stable only after all platform receipts and an independent review are attached.

## Explicit non-goals for the first cross-platform release

- Cross-compiling native helpers from a different operating system.
- Silently updating a Linux system package.
- Shipping an unsigned macOS build or bypassing Gatekeeper/notarization.
- Creating releases from a workstation or from an unprotected branch.
- Treating workflow completion as proof that a user’s private provider account works.
