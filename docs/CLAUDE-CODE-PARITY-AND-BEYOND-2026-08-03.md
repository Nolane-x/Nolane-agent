# Claude Code Parity and Beyond — Model Operations Focus

## Scope

This comparison is intentionally limited to public operational concepts that affect a coding-agent model layer. It does not claim implementation identity or private behavioral parity.

## Public patterns used as design references

Claude Code publicly documents subagents with separate context and tool permissions, hooks around lifecycle events, reusable skills, MCP integrations, configurable settings, CLI automation, and an SDK. These patterns validate the need for a model layer that is policy-aware, tool-aware, auditable, and usable from both UI and automation surfaces.

Nolane checkpoint 11 does not copy those implementations. It applies the same class of operational requirements to a provider-neutral model control plane:

| Area | Public coding-agent pattern | Checkpoint 11 implementation |
|---|---|---|
| Specialized roles | Dedicated subagents/contexts | Primary, fast, verifier, local and custom portfolios |
| Tool governance | Per-agent tool permissions and hooks | Required-capability blockers and tool reliability evidence |
| Extensibility | Skills and MCP | Provider-neutral profile, discovery, probe and routing contracts |
| Automation | CLI and SDK surfaces | CLI manager plus authenticated HTTP APIs |
| Configuration | Project/user settings | Request-level policy, weights, budgets and deployment constraints |
| Observability | Lifecycle hooks and command output | Health ledger, receipts, warnings, blockers and dossiers |

## Areas designed to go beyond a single-vendor selector

1. **Cross-provider normalized truth.** Exact, imported, inferred, local, quantized, and discovered models share one schema.
2. **Conservative uncertainty.** Unknown capability and unknown price are first-class states, not false confidence.
3. **Policy receipts.** Every evaluation, recommendation, health summary, portfolio, and dossier is receipt-bound.
4. **Provider-diverse fallback.** Resilience is measured across providers/families rather than aliases.
5. **Local resource policy.** RAM/VRAM estimates and local-only constraints participate directly in routing.
6. **Operational learning without silent mutation.** Health observations influence reliability and latency but do not rewrite curated identity.
7. **Full release evidence.** Model management has independent tests and matrix gates.

## Important limitations

- Public documentation cannot establish private implementation parity.
- Provider authentication, billing, quotas, and real-world model behavior remain environment-dependent.
- Catalog facts can age; sync and provider discovery must be rerun.
- Model quality values are routing aids and provenance-bound metadata, not universal benchmark truth.
