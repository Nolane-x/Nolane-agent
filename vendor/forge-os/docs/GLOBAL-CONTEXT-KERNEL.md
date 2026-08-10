# Global Context Kernel

ForgeOS v0.5 controls the complete model request rather than optimizing only skill text. Context is treated as a compiled artifact with accounting, provenance, omissions, and a receipt.

## Global budget

A policy declares the model context limit, hard input limit, output reserve, safety reserve, and category budgets for system, task, skills, code, artifacts, memory, tool output, and references. Required items are selected first. Optional items are ordered by route value. A required item that does not fit causes a blocker instead of silent truncation.

Every excluded item creates an omission entry containing source ID, category, reason, estimated tokens, source hash, and retrieval coordinate. The omission manifest itself is hashed. This makes hidden context loss auditable.

## Token accounting

All materialization and global compilation use the same `TokenAccountingRegistry`. Providers are selected by model family and calibrated from observed provider usage. Conservative byte estimation remains a fallback and includes a safety margin. Resolver and materializer no longer use different token boundaries.

The v0.5 public context benchmark proves that all 33 stable technique packages materialize with the pinned model estimator. It does not claim that estimation error is universally below eight percent until real provider usage receipts exist for the full model matrix.

## Semantic ABI

The Semantic ABI indexes JavaScript, TypeScript, Python, Rust, and Go symbols into stable IDs derived from path, kind, and name. Orientation context excludes function bodies and includes location and content hash. A body fetch can require the expected hash; changed symbols are rejected as stale.

The current implementation is a deterministic orientation layer, not a complete language-server replacement. Direct dependency, call-site, test, and build graph enrichment remains an expansion area.

## Artifact and memory projection

Artifacts are represented by current projections and deltas where possible. Memory is not the source of truth: summaries carry source IDs, hashes, and freshness. Stale summaries are rejected. Full historical material is retrievable through explicit references rather than being copied into every model call.

## Tool output

Raw output is stored in a content-addressed blob. The model receives command, exit code, duration, status, relevant failure ranges, a bounded summary, and the raw receipt. Synthetic benchmark logs above 10,000 lines are reduced by more than 95 percent while retaining detected failure ranges; this is not a guarantee that every arbitrary log can be reduced without additional domain distillers.
