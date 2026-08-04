# Forge Studio 2.12.0 release notes

## Planning & Evidence Governance

Forge Studio now performs a local planning preflight before selecting a model provider. Ambiguous objectives produce a structured `PLANNING_INPUT_REQUIRED` request instead of an invented plan. Clear objectives are matched against the indexed repository to identify related source files, tests, configuration, and documentation, estimate scope, and produce a canonical evidence receipt.

Provider-produced mission steps are then enriched with bounded risk, expected files, required Forge tools, subagent recommendations, and evidence references. Plans are limited to twelve actionable steps; vague or excessive plans are rejected. Every plan revision requires an explicit reason and produces a durable `planning.plan.revised` event with a SHA-256 receipt.

## Audit movement

Sixteen checklist items move from partial to source-and-test verified: 5.23; 7.5, 7.9, 7.18, 7.19; 9.8, 9.9, 9.10, 9.11, 9.16, 9.17, 9.19; and 15.10, 15.11, 15.19, 15.23. Exact counts are generated in `docs/feature-audit-2.12.0.json`; every remaining non-verified item appears in `docs/REMAINING-GAPS-2.12.0.md`.
