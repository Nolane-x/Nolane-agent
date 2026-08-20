# Nolane Agent 0.0.0 — Verification Scope

## Scope

The 0.0.0 release contract verifies coherence among the live product identity, package metadata, SDKs, VS Code extension, generated project manifest, current release documentation, GitHub release workflow, and in-app update policy.

## Required source evidence

- `npm run verify:version` checks the product and packaging version surfaces, including the current documentation set.
- `npm run verify:electron-installer` checks Electron installer identity and Windows update compatibility.
- The focused update tests exercise Windows signed-manifest behavior and macOS/Linux GitHub Releases handoff.
- GitHub Actions validates source, Windows, macOS, Linux, Chromium, UI runtime, performance, ledger, and empty-runtime evidence for the release-candidate branch.

## What this does not prove

This report does not claim that an installer has been published, that every external gate has closed, or that a user’s provider account has completed a real mission. Those outcomes require their own release, environment, and provider receipts.

See `docs/LIMITATIONS-0.0.0.md` and `docs/REMAINING-GAPS-0.0.0.md` for the active non-claims and unresolved evidence requirements.
