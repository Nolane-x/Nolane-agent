# ChatGPT Integration

ForgeOS exposes a remote MCP endpoint, strict structured tool contracts, and a Forge Studio MCP App resource. ChatGPT is one host for the same provider-neutral control plane used by Codex, Claude Code, OpenCode, and generic MCP/A2A clients.

## Deployment boundary

Deploy the server behind HTTPS. Configure either verified OIDC or service API keys; never enable anonymous access on a non-loopback listener. Set an exact comma-separated `FORGEOS_ALLOWED_ORIGINS` value matching the ChatGPT/App host and your trusted administration origins.

Recommended production controls:

- OIDC issuer, audience, tenant, role, and scope validation;
- project ACL and tenant-scoped federation policy enforced server-side;
- secrets supplied through mounted secret files or a secret manager;
- edge rate limits and request-size limits;
- trusted reverse-proxy handling with a fixed public base URL;
- immutable audit receipts without credentials or user content in metric labels.

A single `FORGEOS_API_KEY` remains suitable for a dedicated service account or isolated development environment. It is not a replacement for multi-user identity and delegated authorization.

## Skill and MCP federation

ChatGPT may discover capabilities, providers, knowledge references, and MCP metadata through ForgeOS. Discovery never grants execution trust:

1. external skills are synchronized only from immutable source revisions;
2. imported providers enter quarantine;
3. static security and prompt-injection scans run before evaluation;
4. trusted evaluation receipts and human federation-admin approval are required for promotion;
5. MCP execution is limited to promoted providers and declared tool allowlists;
6. secrets are resolved server-side and are never returned to the widget.

The Studio receives a frozen execution bundle or bounded context pack. It does not automatically load every skill, download remote knowledge bodies, or execute repository scripts.

## MCP App behavior

The embedded Forge Studio widget consumes structured tool output and uses the host bridge when available. It also operates at `/dashboard` through a negotiated same-origin MCP session for standalone verification.

Keep irreversible actions behind explicit human approval, validate all arguments and outputs server-side, and use a restrictive content-security policy. The widget must display the current tenant, project, provider trust state, evidence subject, and error state rather than inferring success from workflow position.

## Verification

Before registering the endpoint in ChatGPT:

```bash
npm ci
npm run validate
npm run smoke
npm run federation:eval
npm run federation:audit
npm run release:verify
```

The ChatGPT adapter is documentation-tested unless the exact remote host/version has been exercised externally. Local MCP TCK results do not constitute certification by OpenAI.
