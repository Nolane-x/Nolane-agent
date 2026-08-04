# Forge Studio 2.18.0 release

## Adaptive Harness Lab

This release closes the largest harness-level gap left after Adaptive Work Fabric: different provider families no longer receive one nearly identical instruction, tool-ordering and recovery contract. Forge Studio now composes immutable, versioned public harness profiles at the real provider-call boundary and measures profile changes through controlled replay before explicit promotion.

### Added

- Built-in harness profiles for Codex CLI, Claude Code, Gemini CLI, OpenAI API, Anthropic API, Gemini API and bounded generic-local fallback.
- Canonical profile SHA-256 identities, validation, deep immutability, candidate registration, explicit promotion and rollback receipts.
- Deterministic request composition with provider-specific public directives, context strategy, tool ordering, patch strategy, schema caps and classified retry guidance.
- Provider `harnessFamily` metadata while preserving provider-neutral adapters and existing tool JSON schemas.
- Failure taxonomy for rate limits, timeouts, overload, context overflow, malformed/unavailable tools, sandbox denial, patch conflicts, regressions and no-progress loops.
- Privacy-bounded SQLite telemetry that rejects raw prompts, model output, environment values, secrets and unknown fields.
- Dual-profile replay using the existing EvalRunner, critical-regression rejection, pass-rate protection, weighted efficiency comparison and exact candidate-hash binding.
- AgentLoop composition immediately before every provider request, classified retry/fallback evidence and profile receipts in public events/checkpoints.
- One lifecycle facade so `src/app.mjs` remains at 160 static imports and 180 constructor expressions.
- Required Full Release Matrix gate `adaptive-harness-lab` and reproducible synthetic measurement.

### Audit position

The 790-item audit remains 734 `verified_source_test`, 0 `partial`, 56 `external_gate` and 0 `not_implemented`. This release strengthens model/provider adaptation behind existing requirements; it does not claim autonomous online self-modification, operated cloud services, process-tree resource attribution, full browser journey verification or benchmark superiority.
