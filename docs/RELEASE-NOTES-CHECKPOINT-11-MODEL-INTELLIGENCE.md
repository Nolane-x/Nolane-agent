# Nolane Agent 5.0.0-beta.6 — Forensic Recovery Checkpoint 11

## Model Intelligence Complete Delivery

Checkpoint 11 merges the checkpoint-10 UX foundation with the standalone Nolane Model Profiles package and promotes model metadata into a production-wired, provider-neutral control plane.

### Added

- 567 exact normalized model profiles and 75 family/size templates from the supplied profile package.
- Catalog imports, discovery, sync/export scripts, provenance, confidence, lifecycle, pricing, context, architecture, local deployment estimates, and conservative unknown handling.
- Smart model policy engine with hard capability/context/cost/latency/locality/lifecycle/provider/health gates.
- Explainable scoring and provider-diverse fallbacks.
- Primary/fast/verifier/local model portfolios.
- Health ledger with bounded samples, reliability, latency percentiles, spend, token counts, tool success, manual state, circuit breaker, redaction, and receipts.
- Detailed JSON and Markdown dossiers for all exact profiles.
- Authenticated HTTP management endpoints and CLI management commands.
- Compatibility adapter preserving checkpoint-10 UI/provider APIs.
- Dedicated tests and full-release-matrix gates.

### Correctness fixes found during integration

- Sparse provider records no longer erase curated exact capabilities with null discovery fields.
- The legacy compatibility merge no longer overwrites the advanced profile object with a flattened compatibility layer.
- Policy tests explicitly distinguish quality-first, cost-first, and local-only selection intent.

### Retained limitations

This delivery does not close external certification gates that require specific Windows hardware, assistive technology, visual viewport capture, performance instrumentation, or authenticated real-provider dogfooding. Those entries remain listed in the release evidence.
