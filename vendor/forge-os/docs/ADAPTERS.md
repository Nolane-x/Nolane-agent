# Platform Adapters

ForgeOS separates **protocol-tested configuration** from **documentation-only integration guidance**.

## Evidence levels

- `executable`: the local TCK spawns the declared command, completes MCP initialization, sends the ready notification, and verifies tool discovery.
- `documentation`: installation and contract guidance exists, but the repository does not claim that the upstream vendor host was executed or certified.

The inventory lives in `tck/platform-capabilities.json`; generated evidence is written by `npm run adapter:tck`.

## Protocol-tested configurations

Codex, Claude Code, Cursor, OpenCode, Cline, Roo Code, Windsurf, Continue, and a generic MCP host configuration.

## Documentation-only integrations

ChatGPT remote MCP Apps deployment, Gemini CLI, GitHub Copilot CLI, NolaneNative Agent, OpenClaw, and Pi.

These categories are intentionally different. A local stdio lifecycle test proves the declared protocol configuration. It does not prove every host-specific installation path, UI behavior, authentication model, or vendor release.

## Run the TCK

```bash
npm run adapter:tck
npm run lint:adapters
```

The result applies only to the exact repository version, configuration, runtime, and local environment recorded by the TCK.
