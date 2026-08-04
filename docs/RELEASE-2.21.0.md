# Forge Studio 2.21.0 release

## Repository Intelligence Fabric

This release implements the next bounded slice of the 1,150-item Frontier Program: transparent embedding-provider selection, an optional lazy ONNX runtime contract, content-addressed quantized vector reuse, two-stage hybrid retrieval, chunk-level Merkle invalidation, branch-aware snapshots, and a citation-bound Repository Digital Twin.

### Added

- `EmbeddingProviderRegistry` with explicit provider capabilities, model SHA-256, and degraded-mode status.
- Optional `OnnxCodeEmbeddingProvider` and verified model-pack contract loaded only on semantic demand.
- INT8 vector codec and persistent vector cache scoped by content hash, provider, model digest, and revision.
- Hybrid retrieval that narrows through lexical, symbol, import/graph, and test signals before semantic reranking of at most 300 candidates.
- Chunk-level Merkle diff and branch/worktree provenance for incremental reuse.
- Repository Digital Twin nodes and cited relations for workspace, packages, files, symbols, tests, configuration, build scripts, dependencies, imports, and test verification.
- Explicit unknown runtime relations rather than guessed edges.
- One lazy Repository Intelligence Fabric facade with pressure-aware semantic suspension and lexical-only continuity.
- Required Full Release Matrix gate `repository-intelligence-fabric`.

### Honest audit movement

The 1,150-item audit moves only directly evidenced behavior. The ONNX INT8 requirement remains partial because Core contains a verified lazy contract but does not bundle or operate a production neural model pack. Full polyglot AST/LSP, runtime traces, mmap vector storage, real-repository recall/accuracy benchmarks, and independent comparative superiority remain open.
