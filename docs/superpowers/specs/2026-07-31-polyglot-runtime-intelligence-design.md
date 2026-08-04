# Forge Studio 2.22.0 Polyglot Runtime Intelligence Design

## Goal

Deepen Forge Studio's repository understanding with explicit language capabilities, complete LSP operations, provenance-bound relationship graphs, bounded runtime observations, and architecture drift detection while preserving local-first operation and honest degraded modes.

## Scope

The release adds one lazy `PolyglotIntelligencePlane` facade. It composes focused units rather than expanding `src/app.mjs`: a language capability matrix, grammar-pack registry, pooled LSP sessions, a relationship graph fusion service, a bounded runtime observation store, source classification, and an architecture drift sentinel.

Tree-sitter and language servers remain externally operated runtimes. A language is only reported as `operated` when the target binary/grammar is probed and a raw receipt is produced. Protocol code exercised only through a fixture is marked `contract-tested`, never production-certified.

## Components

### LanguageCapabilityMatrix

Tracks parser, LSP, build, test, runtime and graph capabilities per language. Each capability has `operated`, `contract-tested`, `degraded`, `unavailable`, or `external-gate` status plus version, provider and evidence IDs.

### GrammarPackRegistry

Pins grammar pack IDs, supported extensions, command/version and digest. It probes the external runtime and rejects version/digest mismatch. It never silently falls back while claiming Tree-sitter parity.

### LspSessionPool and CodeIntelligenceService V2

Reuses a bounded LSP process per language/workspace and supports definition, references, rename, hover, type definition, diagnostics and call hierarchy. Idle sessions close after TTL; failures return explicit unavailable evidence.

### RelationshipGraphFusionService

Normalizes exact AST/LSP/build/test/runtime edges into one schema. Every edge includes provenance, confidence and ambiguity. Unresolved dynamic dispatch remains an ambiguous edge rather than a guessed target.

### RuntimeObservationStore

Accepts permission-bound observations from sandbox/process/browser/tool execution: call, exception, request, event, state transition, database query, file/network/process access. It redacts secrets, bounds payload size and links observations to task, process and symbol when available.

### SourceClassifier

Classifies source, test, generated, vendored, migration, lockfile, build output and configuration using explicit repository rules and evidence. Generated/build output may not be edited through normal source patch paths.

### ArchitectureDriftSentinel

Evaluates dependency cycles, forbidden layer direction, duplicate logic signatures, public-boundary violations and generated-source edits. Findings contain severity, evidence, confidence and remediation; only configured high-confidence blocking rules fail a gate.

## Data Flow

Repository change → source classification → parser/LSP capability selection → exact edges → graph fusion → Digital Twin update → drift evaluation. Runtime observations append additional edges without rewriting static evidence. Context retrieval queries exact symbol/test/build/runtime evidence before broad semantic search.

## Error Handling

Missing binaries, unsupported languages and stale runtime evidence return explicit status and receipts. Timeouts terminate the owned process/session. No relation is invented to hide missing runtime support.

## Verification

Tests must prove protocol operations, session reuse/eviction, graph provenance, ambiguity preservation, runtime redaction, source classification and drift blocking. Release measurement operates real installed `clangd` and `sourcekit-lsp` capability probes where available, while other language runtimes remain non-claimed. Full release matrix, audit counts, archive reconstruction and platform non-claims remain mandatory.
