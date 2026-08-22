# Nolane Agent 0.0.1 GitHub Release Runbook

## What the pipeline produces

A tag matching `v<package.json version>` starts `.github/workflows/release.yml`. GitHub Actions reruns the release matrix, builds native helpers on native runners, and publishes an x64 NSIS `.exe`, macOS DMG and ZIP, and Linux AppImage and DEB. It uploads the `electron-updater` metadata (`latest.yml`, `latest-mac.yml`, and `latest-linux.yml`), SHA-256 checksums, and GitHub artifact attestations with the release.

## Required repository settings

No private update-signing key, Windows certificate, or macOS certificate is required to build and publish Nolane Agent 0.0.1. Windows and macOS artifacts are unsigned and can show platform trust warnings. If code signing is adopted later, put certificate material only in GitHub Actions secrets; never commit a private key, certificate, or password.

## Publishing

1. Update release identity surfaces and run the full release matrix.
2. Commit a clean tree.
3. Create a protected tag matching the package version, for example `v0.0.1`.
4. Push the tag.
5. Review the Actions run, artifact attestation, checksums, platform artifacts, and GitHub Releases metadata.
6. Install and update-test the release on a disposable machine before promoting it broadly.

The packaged app uses `electron-updater` against GitHub Releases. It checks downloaded packages against release metadata, waits for an explicit **Update and restart** action, blocks installation while a mission is active, records recovery data, replaces the existing application, and preserves user data.
