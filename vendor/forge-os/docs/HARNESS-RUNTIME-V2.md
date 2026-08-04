# Harness Runtime v2

ForgeOS models rules, hooks, skills, and agent roles as different runtime surfaces.

| Surface | Runtime meaning |
|---|---|
| Rule | Short invariant evaluated on every applicable event |
| Hook | Deterministic handler bound to an event |
| Skill | Conditional technique requiring judgment |
| Agent role | Separate context, tools, model, and authority |

## Neutral event contract

Examples include:

```text
session.created
session.resumed
before.prompt.submit
before.tool.execute
after.tool.execute
before.file.write
after.file.write
before.mcp.execute
after.mcp.execute
before.agent.delegate
after.agent.complete
verification.checkpoint
session.compact
session.ended
```

Adapters map each event to a host-native feature or report it as unsupported. Unsupported capability is never advertised as host-enforced.

## Profiles

`minimal`, `coding`, `creative`, `research`, `regulated`, `local-small`, and `enterprise` compile into a read-only installation plan and permission diff. Installation requires a human harness administrator. Uninstall removes only files whose content still matches the managed record; user overrides are preserved.

## Memory isolation

Memory namespaces include tenant, project, user, and harness. Injection is bounded, confidence-aware, freshness-aware, and trust-domain-aware.
