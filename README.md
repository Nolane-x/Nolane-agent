# Nolane Agent

![Nolane Agent mark](build/icon.svg)

[![Release](https://img.shields.io/github/v/release/Nolane-x/Nolane-agent?display_name=tag&sort=semver)](https://github.com/Nolane-x/Nolane-agent/releases/tag/v0.0.0)
[![Build](https://img.shields.io/github/actions/workflow/status/Nolane-x/Nolane-agent/ci.yml?label=verification)](https://github.com/Nolane-x/Nolane-agent/actions/workflows/ci.yml)
[![Platforms](https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-7c6cf0)](https://github.com/Nolane-x/Nolane-agent/releases/tag/v0.0.0)

**Nolane Agent is a local-first workspace for directing capable AI agents through real software projects.** It brings project-aware chat, provider and model choice, governed tools, browser work, a skill library, review, evidence, and recovery into one desktop application.

`v0.0.0` is available now. Historical checkpoint and beta documents remain in the repository as immutable provenance; they are not the current release documentation.

| Download | Package |
| --- | --- |
| Windows | [NSIS installer (.exe)](https://github.com/Nolane-x/Nolane-agent/releases/download/v0.0.0/NolaneAgent-Setup-0.0.0-x64.exe) |
| macOS | [DMG](https://github.com/Nolane-x/Nolane-agent/releases/download/v0.0.0/NolaneAgent-0.0.0-x64.dmg) or [ZIP](https://github.com/Nolane-x/Nolane-agent/releases/download/v0.0.0/NolaneAgent-0.0.0-x64.zip) |
| Linux | [AppImage](https://github.com/Nolane-x/Nolane-agent/releases/download/v0.0.0/NolaneAgent-0.0.0-x86_64.AppImage) or [Debian package](https://github.com/Nolane-x/Nolane-agent/releases/download/v0.0.0/NolaneAgent-0.0.0-amd64.deb) |

## Why Nolane Agent

- **Work from the real project** — choose a local folder before an agent acts, then move naturally between chat, files, terminal, diffs, browser activity, and live execution.
- **Use the agent runtime you already have** — discover supported API and CLI providers, including major Codex, Claude, Gemini, OpenCode, and local/compatible ecosystems. Model selection is exposed only where the selected provider can actually honour it.
- **Tune reasoning without fake controls** — choose model-specific effort where it is supported, while preserving the provider's own constraints and defaults when it is not.
- **Keep control at every risk level** — choose Ask for approval, Approve for me, or Full access; review plans, tool activity, results, and recovery receipts rather than handing work to an opaque black box.
- **Build a reusable skill system** — search, inspect, install, and attach provenance-bound local and Forge OS skills. Plugins and MCP stay governed through the Control Plane.
- **Progress from a simple chat to an expert workspace** — Everyday, Workspace, Studio, and Expert views reveal more capability without hiding runtime state or making the UI feel overloaded.
- **Recover deliberately** — durable checkpoints, error states, update recovery, and restart safeguards keep missions and local data under the user's control.

## Desktop delivery and updates

GitHub Actions is the only release packaging environment. A tag matching the package version creates native artifacts on GitHub runners:

- Windows: unsigned NSIS installer and `latest.yml` update metadata. Windows may show an **Unknown Publisher** warning.
- macOS: unsigned DMG and ZIP. macOS Gatekeeper may require an explicit user confirmation before launch.
- Linux: AppImage and DEB.

When a packaged installation sees a newer GitHub Release, the application presents an explicit **Download update** action followed by **Update and restart**. Windows, macOS, and Linux use GitHub Releases metadata through `electron-updater`; downloaded packages are checked against that metadata before handoff. Updates never install automatically, and an active mission blocks restart until it is safe. The NSIS installer replaces the existing Windows installation in place while preserving the application data directory, and Nolane records a recovery snapshot before restart.

The public [v0.0.0 release](https://github.com/Nolane-x/Nolane-agent/releases/tag/v0.0.0) is built entirely by GitHub Actions and includes checksums plus provenance attestation. The artifacts are currently unsigned: Windows may show **Unknown Publisher**, and macOS Gatekeeper may require an explicit user confirmation. Authenticode and Apple signing are future hardening work, not release gates for Nolane Agent 0.0.0.

## Architecture

```text
Goal / conversation
  → mission plan and task graph
  → selected project, context, skills, provider, and model
  → governed tools, browser, terminal, and agent runtime
  → review, verification, evidence, and recovery receipts
```

The desktop shell is Electron with a sandboxed renderer and narrow preload bridge. The local runtime is loopback-only and stores durable state locally. `ui-v3` is the editable interface source; `ui-dist` is its deterministic build output. The legacy `ui` directory remains a recovery surface until its retirement gates are satisfied.

## Honest scope

The source tree contains implementation and CI evidence, not proof of every external environment. Current acceptance evidence records 1,460 canonical items: 1,372 verified and 88 external gates. Provider-real credentials, independent accessibility work, every hardware/platform journey, and actual public-release replay remain explicitly bounded by their own evidence requirements.

## Build and verification

```bash
npm test
npm run build:ui-v3
npm run verify:version
npm run verify:electron-installer
```

## Current release documents

- [Release notes](docs/RELEASE-0.0.0.md)
- [Known limitations](docs/LIMITATIONS-0.0.0.md)
- [Verification scope](docs/VERIFICATION-REPORT-0.0.0.md)
- [Remaining gaps](docs/REMAINING-GAPS-0.0.0.md)

## Historical evidence

Prior beta, checkpoint, audit, and forensic documents are retained under `docs/`, `docs/checkpoints/`, `requirements/`, and `evidence/`. Their versioned filenames and recorded values are historical provenance, not current product branding.
