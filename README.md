# Nolane Agent 0.0.0

Nolane Agent is a local-first workspace for directing AI agents across a real project. It combines governed missions, provider and model selection, tools, browser work, skills, review, evidence, and recovery in one desktop application.

`0.0.0` is the canonical stable release identity for this product. Historical checkpoint and beta documents remain in the repository as immutable provenance; they are not the current release documentation.

## What the product provides

- **Chat and missions** — turn a request into a visible plan, tasks, tool calls, checks, evidence, and a completion outcome.
- **Project-aware work** — select a local folder as the working project before an agent acts; use Studio for files, terminal, diffs, browser activity, and live execution.
- **Provider and model control** — discover supported API and CLI providers, choose a model when the provider can forward one, and keep provider-specific constraints visible rather than pretending every model option is universal.
- **Skills and extensions** — search, inspect, install, and attach provenance-bound local and Forge OS skills; plugins and MCP remain controlled through the Control Plane.
- **Progressive UI** — Everyday, Workspace, Studio, and Expert views expose increasing detail without hiding the actual state of an operation.
- **Review and recovery** — approval modes, durable receipts, checkpoints, error states, and update recovery preserve user control.

## Desktop delivery and updates

GitHub Actions is the only release packaging environment. A tag matching the package version creates native artifacts on GitHub runners:

- Windows: signed NSIS installer with the signed Nolane update manifest; the release workflow fails closed without Windows signing credentials.
- macOS: signed DMG and ZIP; the release workflow fails closed without macOS signing credentials.
- Linux: AppImage and DEB.

When a packaged installation sees a newer GitHub Release, the application presents an explicit **Download update** action followed by **Update and restart**. Windows uses the Nolane signed update-manifest path. macOS and Linux use GitHub Releases metadata through `electron-updater`. Updates never install automatically, and an active mission blocks restart until it is safe.

No public GitHub Release is created by this repository change. A maintainer must still create the matching tag and provide the required GitHub Actions secrets: `NOLANE_UPDATE_PRIVATE_KEY_B64`, `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD`, `MAC_CSC_LINK`, and `MAC_CSC_KEY_PASSWORD`.

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
