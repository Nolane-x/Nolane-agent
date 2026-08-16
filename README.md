# Nolane Agent 0.0.0

[![CI](https://github.com/Nolane-x/Nolane-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/Nolane-x/Nolane-agent/actions/workflows/ci.yml)
[![Security](https://github.com/Nolane-x/Nolane-agent/actions/workflows/security.yml/badge.svg)](https://github.com/Nolane-x/Nolane-agent/actions/workflows/security.yml)

Nolane Agent is a local-first, evidence-driven agent workspace for software engineering. It combines autonomous missions, governed tool execution, project memory, model routing, review surfaces, browser/MCP integration, subagent orchestration, and explicit evidence about what actually happened.

**0.0.0 is the first canonical release.** From this baseline the project advances as `0.0.1`, `0.0.2`, and so on until the version policy is intentionally changed.

## What is included

- **Projects and Missions** — persistent workspaces and long-running engineering tasks.
- **Agent runtime** — bounded turns, token/time/tool budgets, cancellation, retry and provider failover.
- **Subagents** — parallel delegated work with governed capabilities, concurrency limits and structured cancellation.
- **Evidence Spine** — tool receipts, state transitions, review context and claim boundaries instead of self-certified completion.
- **Studio and Review** — code-oriented inspection and change review surfaces.
- **Browser and MCP** — allowlisted external tools routed through governed gateways.
- **Model control plane** — provider profiles, routing, health, policy and local model management.
- **Desktop application** — Electron packaging for Windows, macOS and Linux.
- **VS Code and SDK surfaces** — extension plus TypeScript/Python SDKs.

## Install from source

Requirements: Node.js 22.13+ and Go for native helper validation.

```bash
npm ci
npm run verify:version
npm run test:core
npm start
```

Desktop development:

```bash
npm install --no-save --package-lock=false electron@43.2.0 electron-builder@26.15.3
npm run start:electron
```

## Quality gates

```bash
npm run validate
npm test
npm run test:go
npm run build:vscode
npm run build:ui
npm run verify:ui
```

CI runs the release identity contract, core regression suite and platform smoke checks on Linux, Windows and macOS, with the complete Node/Go suite on Linux. Releases are immutable `v0.0.x` tags with platform packages, a release manifest, SHA-256 checksums and GitHub-hosted provenance where available.

## Platform truth

| Platform | Package | 0.0.0 update/install truth |
|---|---|---|
| Windows | NSIS x64 | Installer build supported. In-app update feed is disabled until signed-update evidence is configured. |
| macOS | DMG + ZIP x64 | Package build supported. Native in-app install handoff is not yet claimed. |
| Linux | AppImage + DEB x64 | Package build supported. Native in-app install handoff is not yet claimed. |

No signing, notarization, real-machine, accessibility-certification or dogfood result is claimed without a corresponding receipt. See [Platform support](docs/PLATFORMS.md).

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Development](docs/DEVELOPMENT.md)
- [Configuration](docs/CONFIGURATION.md)
- [API](docs/API.md)
- [Quality and verification](docs/QUALITY.md)
- [Release process](docs/RELEASES.md)
- [Platform support](docs/PLATFORMS.md)
- [Roadmap](docs/ROADMAP.md)
- [Security policy](SECURITY.md)
- [Contributing](CONTRIBUTING.md)
- [Support](SUPPORT.md)

## License

MIT. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
