# Nolane Agent 0.0.0 — Release Notes

Nolane Agent 0.0.0 establishes the canonical stable release identity for the local-first agent workspace. It replaces the previous beta label on the live package, desktop shell, SDKs, VS Code extension, release identity, project manifest, current README, and current release-document set.

## Product surface

- Project-aware chat, missions, review, evidence, recovery, browser work, Studio, Control Plane, skills, plugins, MCP, and provider/model management remain part of one local desktop workspace.
- Provider and model controls state their actual capability. A CLI that selects its model in its own configuration is not presented as though Nolane can override it.
- Settings preserve navigation and focus state, expose language and appearance choices, and offer Everyday, Workspace, Studio, and Expert experience levels.

## GitHub-only desktop delivery

The tag-triggered GitHub Actions workflow builds the release on native runners only:

- signed Windows NSIS, including the signed Nolane update-manifest path and required Windows signing credentials;
- macOS DMG and ZIP, with required macOS signing credentials;
- Linux AppImage and DEB.

The packaged app presents **Download update** and then **Update and restart** when a newer release is available. Windows uses the signed Nolane update manifest. macOS and Linux use GitHub Releases metadata through `electron-updater`. An update restart is blocked while a mission is active and creates recovery data before installation.

## Publication boundary

This document does not create a GitHub Release. Publication requires the matching `v0.0.0` tag, all required GitHub Actions secrets, exact-head candidate evidence, and a successful release workflow.

## Evidence boundary

This release identity does not claim universal provider or platform parity. The current acceptance ledger and release candidate checks remain the source of truth for verified behavior and external gates.
