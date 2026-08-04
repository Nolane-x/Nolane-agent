# Forge Studio 3.1 Intelligence Completion Kernel Design

## Goal

Close the 13 internal `not_implemented` requirements remaining after Forge Studio 3.0.0 without weakening the existing local-first, bounded-governance, verification, privacy, or human-control boundaries.

## Scope

The release implements requirements `30.13`, `30.14`, `30.15`, `31.12`, `32.5`, `32.8`, `32.13`, `32.16`, `33.6`, `33.7`, `36.12`, `36.13`, and `36.17` with direct source, direct tests, integration evidence, release measurement, audit transition, and explicit non-claims.

## Non-goals

- No cloud sandbox, provider-hosted service, autonomous pull request, autonomous merge, release publication, or production policy promotion.
- No claim of full Tree-sitter/LSP language parity, production-grade whole-program analysis, or real-world superiority over other coding agents.
- No hidden model training or learning from unverified outcomes.
- No requirement is promoted merely because an interface or mock adapter exists; each promoted item needs deterministic behavioral evidence.

## Architecture

### 1. Context Learning Kernel

`ContextLearningKernel` consumes task signals and bounded evidence adapters. It creates deterministic query expansions from exact symbols, stack frames, failing tests, Git changes, dependency neighbors, and counter-evidence targets. Expansion order is exact/structural/runtime/historical/semantic, with deduplication and provenance receipts.

The same kernel owns a verified evidence-utility ledger. Utility updates are accepted only when a verification receipt proves an outcome. Unverified, failed, or ambiguous outcomes remain observational and cannot change learned preferences. A context-ablation replay API reruns a caller-supplied verifier against the full packet and packets with one evidence card removed; it reports evidence whose removal causes no verified loss, but never deletes context automatically.

### 2. Paged Semantic Vector Store

`PagedVectorStore` persists quantized vector records into checksummed pages plus a compact manifest. Search loads only the pages selected by a coarse page directory or an explicit bounded page range. The store exposes page-read counts and peak loaded bytes so tests can prove the complete index is not retained in memory. Corrupt pages, dimension mismatch, and checksum mismatch fail closed.

### 3. Repository Twin Enrichment

`RepositoryIntelligenceCompletionService` enriches existing repository intelligence with four bounded projections:

- commit-to-architecture and issue-to-code relations, each labelled as observed metadata or inference and never as causal proof;
- a module map describing responsibility, dependency direction, owners, public surface, and source citations;
- architecture pattern/convention/legacy/security-zone detection using explicit rules and citations;
- Git-derived ownership, churn, hotspot, regression, and risk profiles with bounded history and exact commit evidence.

All facts carry branch, source hash, confidence, evidence kind, and invalidation keys.

### 4. Program and Patch Analysis Kernel

`ProgramAnalysisKernel` accepts a normalized function IR from existing AST/LSP adapters. It builds a bounded intraprocedural control-flow graph and an interprocedural data-flow graph. Unknown dynamic edges are retained as ambiguous rather than guessed.

`VariableLineageService` tracks symbol identity through rename, move, type/nullability/scope changes, serialization names, and database mappings. It produces a temporal binding chain keyed by source hashes and rejects incompatible or uncited transitions.

`CounterfactualPatchAblator` removes one candidate hunk at a time in isolated caller-provided worktrees, invokes the unchanged verification contract, and reports hunks that are unnecessary, required, or inconclusive. It cannot apply, merge, or publish a patch.

### 5. Integration

The four services are owned lazily by `RepositoryIntelligenceFabric` and exposed through bounded methods. Fast-path repository indexing and lexical search do not instantiate them. `DecisionPlane` remains unchanged unless an existing facade is required; application wiring must not import completion modules directly.

### 6. Release Certification

A deterministic measurement exercises all 13 behaviors. A required gate `intelligence-completion-kernel` verifies source, direct tests, measurement receipt, audit statuses, non-claims, lazy integration, and resource bounds. The audit transitions only the 13 listed items to `verified_source_test`; partial and external-gate items remain unchanged unless separately evidenced.

## Data Flow

1. Task input is normalized into exact symbols, stack frames, failing tests, Git deltas, dependency neighbors, and active hypotheses.
2. Context Learning Kernel emits signed query plans and builds an evidence packet through existing retrieval adapters.
3. Verification outcomes update utility only after receipt validation; optional ablation replay identifies low-value evidence.
4. Repository indexing writes vector pages and repository-twin projections using current source/branch hashes.
5. AST/LSP adapters provide normalized IR for CFG/DFG and variable-lineage analysis.
6. High-risk patch candidates may run isolated hunk ablation under the original verification contract.
7. Release measurement records behavior and resource receipts; the audit generator changes statuses only after the mandatory gate passes.

## Error Handling and Safety

- Inputs, arrays, graph size, page size, history depth, and adapter calls are bounded.
- Every public result is canonical, deeply frozen, content-addressed, and secret-redacted where text may contain credentials.
- Missing source hashes, invalid verification receipts, stale branch evidence, corrupt vector pages, ambiguous variable identity, or adapter failures fail closed or return explicit `inconclusive` status.
- No service executes Git merge, push, pull request creation, deployment, production writes, or autonomy expansion.

## Testing

- Unit tests for query expansion, verified-only learning, ablation replay, page-bounded reads, checksum failures, module/risk projections, CFG/DFG, variable lineage, and patch hunk ablation.
- Integration tests proving lazy lifecycle through `RepositoryIntelligenceFabric` and no direct application import.
- Regression batches for context engine, semantic dependency, repository intelligence, AST intelligence, patch governance, world-model counterfactuals, DecisionPlane lifecycle, and full release matrix.
- Release measurement and mandatory gate on the exact release commit.

## Honest Status Policy

This release can claim deterministic bounded implementations of the 13 internal requirements. It cannot claim production-scale whole-program analysis, production ONNX retrieval quality, cross-platform native isolation, cloud execution, independent comparative superiority, or real 7–30 day field survival without separate evidence.
