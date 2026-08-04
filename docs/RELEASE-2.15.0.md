# Forge Studio 2.15.0 release

## Evidence Context Runtime

This release unifies repository evidence, runtime evidence, history, memory, context selection, leases, and recovery into one local receipt-backed runtime. AgentLoop receives a governed structured packet before the first model call.

### Added

- Durable typed Evidence Graph and relation graph.
- File, test, plan, dependency, and requirement lease invalidation.
- Five-source retrieval with exact reciprocal-rank fusion.
- Query decomposition and explicit counter-evidence retrieval.
- Structured context packets with token budget and completion criteria.
- Lossless compaction into DynamicContextStore artifacts.
- Evidence-backed memory and structured subagent handoffs.
- Context audit and non-mutating recovery recommendations.
- Authenticated Evidence Runtime API and UI center.
- Required Full Release Matrix gate `evidence-context-runtime`.

### Audit

The 790-item audit remains 734 verified source+test, 0 partial, 56 external gate, and 0 not implemented. This release strengthens the implementation behind already-covered context, evidence, memory, retrieval, subagent, and recovery requirements; it does not invent new checklist movement.
