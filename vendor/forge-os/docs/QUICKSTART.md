# ForgeOS v0.6 Quick Start

## Local profile in five minutes

Requirements: Node.js 22 or newer.

```bash
npm install
npm test
node src/cli/forge.mjs init
node src/cli/forge.mjs doctor
npm start
```

Open `http://127.0.0.1:8787/dashboard`.

The local profile uses SQLite WAL, writes its generated API key to `.forgeos/api-key` with mode `0600`, and never prints the secret.

## Find and route techniques

```bash
forge skills search "stale evidence"
forge skills inspect validating-evidence-freshness
forge route --query "review this authentication change without missing related tests"
forge v06 status
```

## Plan a host profile

```bash
forge profile plan coding --target codex
forge profile plan local-small --target generic --no-mcp
```

Planning is read-only. Installation remains a separate human-approved operation.

## Scan an agent surface

Create `agent-surface.json`:

```json
{
  "instructions": [],
  "hooks": [],
  "mcpServers": [],
  "packages": [],
  "allowedCommands": [],
  "envReferences": []
}
```

Then run:

```bash
forge security scan --file agent-surface.json
```

Exit code `2` means a high or critical blocker was found.

## Protocol endpoints

| Endpoint | Purpose |
|---|---|
| `/dashboard` | Forge Studio foundation |
| `/mcp` | MCP Streamable HTTP |
| `/a2a` | A2A JSON-RPC |
| `/.well-known/agent-card.json` | A2A discovery |
| `/health`, `/livez`, `/readyz` | Operations probes |
| `/metrics` | Prometheus exposition |

## Next steps

- [Architecture](ARCHITECTURE.md)
- [Deterministic Skill Fabric](DETERMINISTIC-SKILL-FABRIC-V06.md)
- [Security](AGENT-SURFACE-SECURITY.md)
- [Production](PRODUCTION.md)
- [Claims Boundary](CLAIMS-BOUNDARY-V0.6.md)
