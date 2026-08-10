# Agent Surface Security

ForgeOS scans the agent configuration surface, not only the product repository.

## Scanned surfaces

- system and project instruction files;
- skill and agent-role definitions;
- hooks and package lifecycle scripts;
- MCP servers, tool descriptions, and permissions;
- allowed commands;
- environment-variable references;
- profile permission changes;
- memory and learned-instinct sources.

## Current deterministic detections

- instruction-boundary override attempts;
- secret access combined with outbound transfer;
- `curl`/`wget` pipe-to-shell;
- package install/prepare execution;
- overbroad MCP or command permissions;
- unsafe MCP descriptions;
- sensitive environment references.

The permission graph can expose paths such as:

```text
Agent Role → Tool → Secret Resource → Network Egress
```

High-risk profile installation requires a human `security-admin`. The current adversarial corpus contains 20 cases and is a release gate.

This engine is not a proof that an arbitrary third-party package is safe. Dynamic code still requires sandboxed execution and independent evaluation.
