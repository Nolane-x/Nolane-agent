# Forge Studio 2.21.0 Repository Intelligence Fabric Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a branch-aware, incremental Repository Intelligence Fabric that narrows candidates deterministically, reranks them with a real optional embedding runtime, and exposes a verifiable Repository Digital Twin without increasing Core startup weight.

**Architecture:** Keep Core local-first and dependency-light. Add a provider registry with an optional ONNX model-pack adapter, quantized content-addressed vector cache, two-stage hybrid retrieval, chunk-level Merkle reuse, and one lazy `RepositoryIntelligenceFabric` facade. When an operated ONNX runtime/model pack is unavailable, Forge Studio must report degraded feature-hash fallback explicitly rather than claim neural semantic search.

**Tech Stack:** Node.js ESM, `node:test`, `node:sqlite`, existing StudioStore, ForgeOS canonical receipts, optional injected ONNX runtime/model pack, existing repository scheduler and Evidence Card pipeline.

## Global Constraints

- No mandatory cloud service, network call, or eager model load.
- Keep `FeatureHashEmbeddingProvider` only as an explicitly degraded fallback.
- Do not bundle an unverified model or label a fake runtime as neural embedding.
- Preserve secret-path exclusion and never embed secrets.
- Narrow to at most 300 candidates before neural embedding/reranking by default.
- Cache vectors by content hash, provider ID, model digest, and quantization revision.
- Keep `src/app.mjs` at or below the 2.20 import/constructor budget.
- Every production change follows RED → GREEN → refactor and receives a focused commit.
- Existing 2.16–2.20 release gates remain mandatory.

---

### Task 1: Embedding Provider Registry and Explicit Fallback

**Files:**
- Modify: `src/repository/embedding-provider.mjs`
- Create: `tests/embedding-provider-registry.test.mjs`

**Interfaces:**
- Produces: `EmbeddingProviderRegistry.register(provider)`, `resolve({preferNeural, allowFallback})`, `status()`.
- Provider contract: `{id, kind, dimensions, degraded, modelSha256, embed(texts, options), close?()}`.

- [ ] Write failing tests proving neural preference selects an available neural provider and unavailable neural operation returns explicit degraded fallback metadata.
- [ ] Run `node --test tests/embedding-provider-registry.test.mjs` and verify failure because the registry does not exist.
- [ ] Implement immutable provider descriptors, duplicate-ID rejection, bounded status output, and fallback selection.
- [ ] Add cancellation and batch validation tests.
- [ ] Commit `feat(repository): add embedding provider registry`.

### Task 2: Optional ONNX Code Embedding Provider Contract

**Files:**
- Create: `src/repository/onnx-code-embedding-provider.mjs`
- Create: `src/repository/embedding-model-pack.mjs`
- Create: `tests/onnx-code-embedding-provider.test.mjs`

**Interfaces:**
- Produces: `OnnxCodeEmbeddingProvider` using an injected runtime adapter and verified model-pack manifest.
- Pack contract: `{schema, modelId, modelSha256, tokenizerSha256, dimensions, quantization, files}`.

- [ ] Write failing tests for model-pack byte/hash verification, lazy runtime creation, pooling, cancellation, mean pooling, normalization, idle unload, and bounded `EMBEDDING_MODEL_NOT_INSTALLED` errors.
- [ ] Verify RED.
- [ ] Implement the provider without importing a native ONNX package in Core; runtime is injected by the optional pack/adapter.
- [ ] Prove no inference session is created before the first neural embedding request.
- [ ] Commit `feat(repository): add optional onnx embedding runtime contract`.

### Task 3: Quantized Content-Addressed Vector Cache

**Files:**
- Create: `src/repository/quantized-vector-codec.mjs`
- Modify: `src/repository/secure-semantic-index.mjs`
- Create: `tests/quantized-vector-codec.test.mjs`
- Modify: `tests/secure-semantic-index.test.mjs`

**Interfaces:**
- Produces: symmetric INT8 encode/decode and cache records keyed by chunk hash + provider/model/revision.

- [ ] Write failing tests for bounded cosine loss, deterministic bytes, corrupted payload rejection, and cache invalidation when model digest changes.
- [ ] Verify RED.
- [ ] Implement the codec and migrate semantic cache storage without deleting legacy JSON rows.
- [ ] Batch uncached embeddings and reuse quantized vectors for unchanged chunks.
- [ ] Commit `feat(repository): cache quantized semantic vectors`.

### Task 4: Two-Stage Candidate Narrowing and Hybrid Reranker

**Files:**
- Create: `src/repository/hybrid-code-reranker.mjs`
- Modify: `src/repository/secure-semantic-index.mjs`
- Modify: `src/repository/adaptive-repository-intelligence.mjs`
- Create: `tests/hybrid-code-reranker.test.mjs`
- Modify: `tests/adaptive-repository-intelligence.test.mjs`

**Interfaces:**
- Produces: `HybridCodeReranker.rank(query, candidates, signals)` with lexical, path, symbol, graph, freshness, feedback, and semantic scores.

- [ ] Write failing tests proving symbol definitions/callers/tests enter the candidate pool before broad semantic matches.
- [ ] Add tests limiting neural embedding to 300 candidates and preserving a lexical-only result when the neural provider is unavailable.
- [ ] Implement deterministic weighted fusion with score breakdown and stable tie-breaking.
- [ ] Record the actual provider/degraded state on every search receipt.
- [ ] Commit `feat(repository): add two-stage semantic reranking`.

### Task 5: Chunk-Level Merkle Reuse and Branch Awareness

**Files:**
- Modify: `src/repository/merkle-index.mjs`
- Modify: `src/repository/secure-semantic-index.mjs`
- Create: `tests/merkle-chunk-index.test.mjs`
- Modify: `tests/secure-semantic-index.test.mjs`

**Interfaces:**
- Produces: file/chunk Merkle roots, changed-node diff, branch/worktree fingerprint, and safe snapshot reuse proof.

- [ ] Write failing tests proving one changed chunk does not invalidate sibling chunk vectors.
- [ ] Add tests rejecting snapshot reuse across mismatched branch head, dirty-state fingerprint, provider model digest, or tool schema revision.
- [ ] Implement deterministic Merkle diff and branch-aware index state.
- [ ] Preserve source-hash freshness in Evidence Cards.
- [ ] Commit `feat(repository): add branch-aware chunk merkle reuse`.

### Task 6: Repository Digital Twin

**Files:**
- Create: `src/repository/repository-digital-twin-service.mjs`
- Modify: `src/repository/repository-map-service.mjs`
- Create: `tests/repository-digital-twin-service.test.mjs`

**Interfaces:**
- Produces: a bounded graph of workspace, package, module, file, symbol, test, config, build target, runtime service, and dependency relations with citations.

- [ ] Write failing tests for imports, symbol ownership, `test → verifies → symbol`, config/build relations, branch metadata, citations, invalidation, and bounded export.
- [ ] Verify RED.
- [ ] Build the twin from existing repository files/symbols/imports plus optional relationship/runtime providers; do not invent unsupported edges.
- [ ] Add architecture-layer summaries and explicit unknowns.
- [ ] Commit `feat(repository): add repository digital twin`.

### Task 7: Lazy Repository Intelligence Fabric and Evidence Integration

**Files:**
- Create: `src/repository/repository-intelligence-fabric.mjs`
- Modify: `src/context/hybrid-evidence-retrieval-service.mjs`
- Modify: `src/app.mjs`
- Create: `tests/repository-intelligence-fabric.test.mjs`
- Create: `tests/repository-intelligence-fabric-app-wiring.test.mjs`

**Interfaces:**
- Produces one lifecycle facade exposing `index`, `search`, `digitalTwin`, `status`, `suspend`, `resume`, and `close`.

- [ ] Write failing tests for lazy activation, pressure suspension, idle model unload, sanitized status, and Evidence Card provenance.
- [ ] Verify RED and current composition budget.
- [ ] Wire one facade into `app.mjs`; avoid importing each subsystem separately.
- [ ] Keep lexical/symbol evidence available when semantic work is suspended.
- [ ] Commit `feat(repository): compose repository intelligence fabric`.

### Task 8: Measurement, Audit, Release Gate, and Packaging

**Files:**
- Create: `scripts/measure-repository-intelligence-fabric.mjs`
- Create: `scripts/verify-repository-intelligence-fabric.mjs`
- Modify: `scripts/full-release-matrix.mjs`
- Modify: `scripts/generate-frontier-feature-audit.mjs`
- Create: `tests/repository-intelligence-fabric-release-gate.test.mjs`
- Create: `docs/RELEASE-2.21.0.md`
- Create: `docs/LIMITATIONS-2.21.0.md`

**Interfaces:**
- Produces mandatory gate `repository-intelligence-fabric` and reproducible measurement JSON.

- [ ] Write a failing gate requiring explicit neural/degraded status, candidate narrowing, quantized reuse, Merkle chunk reuse, Digital Twin citations, startup budget, and non-claims.
- [ ] Build a deterministic unseen-repository fixture where the neural adapter is injected and verify it reranks a conceptually related chunk above a lexical distractor.
- [ ] Measure candidate count, embedded count, cache hits, changed chunks, search latency, RSS estimate, twin nodes/edges, and fallback behavior.
- [ ] Update version/audit without claiming an operated production ONNX model pack when none is bundled.
- [ ] Run focused tests, full Node suite, all previous gates, Windows/SDK/ForgeOS/reconstruction/archive gates, and the full release matrix from a clean commit.
- [ ] Commit `release: prepare Forge Studio 2.21.0 repository intelligence fabric`.
