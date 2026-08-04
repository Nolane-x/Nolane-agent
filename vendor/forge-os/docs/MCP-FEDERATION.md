# MCP Federation

MCP discovery and MCP execution are separate trust domains. ForgeOS uses the official MCP Registry as the preferred metadata source and can index community awesome lists for discovery, but community inclusion, stars, or download counts never grant execution authority.

## Broker admission

A server must resolve to a stable tenant-visible provider with an immutable digest, supported transport, current assessment, current scan receipt, explicit tool allowlist, and compatible capability mapping. Private-network endpoints, insecure transports, unknown publishers, dangerous tools, stale metadata, or unresolved license/trust findings block admission.

## Broker execution

The broker resolves credentials from a secret reference outside model-visible context, opens a bounded session, calls only an allowlisted tool, enforces timeout and output-size limits, and closes the session. Write-capable tools require a human operator decision. The audit receipt stores provider/tool identity, request and response hashes, timing, policy version, and outcome; sensitive response bodies are not retained by default.

## Registry synchronization

Official registry metadata can be synchronized as discovery information. It does not bypass scan, evaluation, tenant policy, or human promotion. Awesome lists have no code-execution fetcher and remain discovery-only. Server manifests and tool schemas are runtime validated before a brokered call.

## Current limits

ForgeOS does not claim that every MCP server is safe, that registry metadata is always current, or that broker policy replaces sandboxing on the remote server. Network egress policy, provider-specific credentials, and external service permissions remain operator responsibilities.
