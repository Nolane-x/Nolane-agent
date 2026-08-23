# Nolane Agent 0.0.2 — Release Notes

Nolane Agent 0.0.2 is a focused Electron runtime-closure patch. It corrects the packaged desktop startup path that could leave a new installation on the runtime-recovery screen.

## Fixed

- The Electron archive now includes the TypeScript compiler runtime that Nolane Agent imports during startup.
- The sandboxed preload bridge no longer loads a local CommonJS helper, which Electron does not permit in that sandbox.
- Regression contracts verify the packaged TypeScript dependency and the bounded preload surface before an installer can be built.

## Delivery

GitHub Actions is the only release packaging environment. The matching `v0.0.2` tag builds an unsigned Windows NSIS installer, macOS DMG and ZIP, Linux AppImage and DEB, `electron-updater` metadata, checksums, and provenance attestations on native GitHub runners. Windows can show an **Unknown Publisher** warning and macOS Gatekeeper can require an explicit confirmation.

When a running installation detects this release, it offers **Download update**, then **Update and restart**. The Windows NSIS installer upgrades the existing application in place and preserves the application-data directory.

## Evidence boundary

This patch proves the package closure and checked source behavior, not every live provider, external gate, hardware journey, or real account workflow. Those remain bounded until their named environment produces evidence.
