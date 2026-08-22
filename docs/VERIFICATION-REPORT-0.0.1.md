# Nolane Agent 0.0.1 — Verification Scope

## Scope

The 0.0.1 release contract verifies live product-version coherence, current release documentation, the Electron installer allowlist, and the update coordinator's platform-truth behavior. It specifically covers the dependency that caused the packaged startup failure in 0.0.0.

## Required source evidence

- `npm run verify:version` checks product, package, SDK, extension, manifest, and current-release document version surfaces.
- `npm run verify:electron-installer` checks installer identity, updater compatibility, preserved user data, and the package configuration contract.
- Focused tests exercise Windows, macOS, and Linux GitHub Releases handoff and assert that the update coordinator can resolve packaged platform truth.
- GitHub Actions validates source and external evidence on Windows, macOS, and Linux for the exact release commit.

## What this does not prove

This report does not claim that every external gate is closed or that a user's provider account has completed a real mission. Those outcomes require independent environment and provider receipts.

See `docs/LIMITATIONS-0.0.1.md` and `docs/REMAINING-GAPS-0.0.1.md` for active non-claims and unresolved evidence requirements.
