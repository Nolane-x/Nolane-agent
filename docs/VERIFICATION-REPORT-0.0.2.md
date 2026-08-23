# Nolane Agent 0.0.2 — Verification Scope

## Scope

The 0.0.2 release contract verifies version coherence, desktop installer configuration, packaged TypeScript runtime closure, and the sandboxed preload boundary that previously stopped runtime startup.

## Required evidence

- GitHub Actions is the only release packaging environment, with independent source and external-evidence jobs on Windows, macOS, and Linux.
- The release workflow produces a Windows NSIS installer, macOS DMG and ZIP, and Linux AppImage and DEB from the signed tag candidate.
- The update path exposes **Download update** and **Update and restart** through `electron-updater` GitHub Releases metadata and preserves user data on in-place Windows upgrades.

## What this does not prove

The contracts do not claim that every external gate is closed or that a user's provider account has completed a real mission. Those outcomes require independent environment and provider receipts.

See `docs/LIMITATIONS-0.0.2.md` and `docs/REMAINING-GAPS-0.0.2.md` for active non-claims and unresolved evidence requirements.
