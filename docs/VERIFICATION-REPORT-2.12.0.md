# Forge Studio 2.12.0 verification contract

A 2.12.0 release is valid only when the complete Full Release Matrix runs from gate 1 on a clean committed tree and every required gate passes.

## Planning evidence governance gate

`planning-evidence-governance` must prove:

- local repository indexing without caller-supplied workspace paths;
- missing-information detection and a structured user-input request before provider selection;
- bounded heuristic scope estimates with confidence and file-count ranges;
- direct retrieval of related tests, configuration, documentation, and source metadata;
- per-step risk, expected-file, tool, subagent, and evidence projections;
- rejection of vague plans and plans exceeding twelve steps;
- explicit replanning reasons, durable events, and canonical SHA-256 receipts;
- MissionPlanner and application wiring while preserving compatibility without governance;
- item-level audit evidence for all sixteen checklist requirements;
- explicit non-claim boundaries in `docs/LIMITATIONS-2.12.0.md`;
- inclusion in source reconstruction and release packaging.

All verification evidence is bound to the exact Git commit and written beneath `release/matrix-2.12.0/`.
