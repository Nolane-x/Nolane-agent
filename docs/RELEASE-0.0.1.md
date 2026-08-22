# Nolane Agent 0.0.1 — Release Notes

Nolane Agent 0.0.1 is a focused patch release for desktop reliability. It retains the 0.0.0 product scope and release model while correcting a startup failure in the packaged Electron application.

## Fixed

- The Electron package now includes `config/release-platform-capabilities.json` in `app.asar`.
- `desktop/update-platform-truth.cjs` can load the platform capabilities table during startup instead of throwing `Cannot find module '../config/release-platform-capabilities.json'`.
- A regression contract now fails CI if that configuration file is removed from the `electron-builder` allowlist.

## Delivery

The matching `v0.0.1` tag is built only by GitHub Actions on native Windows, macOS, and Linux runners. It publishes an unsigned Windows NSIS installer, macOS DMG and ZIP, Linux AppImage and DEB, updater metadata, checksums, and provenance attestations.

Windows may show **Unknown Publisher** and macOS may require an explicit Gatekeeper confirmation because this release is unsigned. The installer upgrades the existing Nolane Agent application in place and preserves its application-data directory.

## Evidence boundary

This release records the package-startup fix and its automated contracts. It does not claim that every provider, external environment, accessibility journey, or live update replay has been independently proven.
