# Forge Studio 4.0.0 Local Frontier Completion Design

## Goal

Remove every remaining `partial` item from the 1,150-item audit while keeping claims evidence-bound, packaging NolaneNative 2.29.0 directly in every offline release artifact, and preserving all prior release guarantees.

## Release outcome

- Product version: `4.0.0`.
- Audit target: `1081 verified_source_test`, `0 partial`, `69 external_gate`, `0 not_implemented`.
- Fifty-three partial items become source-and-test verified.
- Six items become external gates because the supplied source does not contain the required production artifact/runtime: `31.2`, `33.1`, `33.2`, `33.3`, `33.4`, and `45.3`.
- NolaneNative 2.29.0 is a required release component. The upstream archive is read and verified during the current run, embedded in source, Windows, and update payload archives, and also published as `ForgeStudio-LegacyExternalRuntime-2.29.0.zip`.
- Carry-forward certification is forbidden for 4.0.0.

## Architecture

### 1. Context and semantic completion

A harness tokenizer pack provides exact BPE token accounting with a content-addressed receipt. A context cache-coherence service binds cached context to source hash, branch, tool-schema digest, harness revision, and tokenizer digest. Semantic indexing gains a bounded batch scheduler, versioned binary vector store, full cache key, retrieval priority policy, resource-pressure unloading, corruption quarantine, and RSS accounting.

The ONNX production model itself remains an external artifact gate. The source verifies pack integrity and runtime contracts but does not label a synthetic model as production.

### 2. Polyglot evidence completion

A polyglot evidence plane unifies build graphs, test/coverage graphs, static call/type relationships, runtime traces, request/event/state/database observations, and file/network/process attribution. Every edge carries source or runtime provenance, confidence, and ambiguity.

Tree-sitter grammar binaries and production language servers are external gates because they are not present in the supplied release source. Adapter contracts and fail-closed validation remain source verified, but the four production-runtime acceptance items are not promoted falsely.

### 3. Memory, resource, and collaboration completion

A governed memory-action learner supports ADD, UPDATE, DELETE, RETRIEVE, SUMMARIZE, and NOOP only from verified trajectories. A user control service supports inspect, edit, invalidate, archive, and delete. Repository causal memory stores architecture decisions with evidence and invalidation keys.

A resource governor enforces process-tree CPU/RSS/process/FD budgets where the platform exposes them, unloads idle resources by TTL and pressure, reuses browser contexts only under a reset contract, predicts heavy demand before admitting embedding workers, and measures cold/warm startup RSS. Collaboration adds independent reviewer context, graph-derived ownership, coalition communication budgets, and routing-regret/overhead/conflict/useful-parallelism metrics.

### 4. Browser, security, and UI completion

Product evidence records before/after screenshots or frame sequences with hashes, performs tolerance-based visual comparison with reviewed ignore regions, requires a human-approved baseline for critical oracles, reuses browser contexts through a reset receipt, exports reviewer demo bundles, evaluates accessibility criteria, and provides rewindable artifact playback.

Failure injection covers network loss, timeout, DNS failure, provider overload, memory/process/orphan/FD pressure, database locks, disk-full behavior, transaction drift, environment leakage, socket escape, and credential escape. The UI work surface exposes code/diff/terminal/browser/test/timeline views, command-palette access, role views, cross-repository chains, virtualized collections, pressure-aware motion, device-doctor projections, performance budgets, and design-state honesty.

### 5. Benchmark completion

The benchmark pack contains content-addressed unseen repository fixtures, realistic bug/feature/refactor/migration/review tasks, a public reproducible suite, an encrypted private held-out suite, and long-horizon/browser/multi-agent/security coverage. Contamination is checked before execution. Real competitor parity remains an external gate because competitor executables, credentials, and licensing are not supplied.

## Evidence and release gates

Four new required gates certify the four local completion planes. A fifth NolaneNative distribution gate verifies direct archive bytes and all nested release copies. The feature audit may change only the 59 previous partial IDs: 53 to verified and 6 to external. All previous verified items and external gates must retain their status.

## Failure policy

- No uncited static or runtime edge becomes a fact.
- No hidden/private benchmark oracle is exposed to the executor.
- No cache survives a provenance-key change.
- No corrupted vector/model/NolaneNative archive is loaded or packaged.
- No critical visual baseline is accepted without a human approval receipt.
- Unsupported platform resource counters are reported as unavailable rather than fabricated.
- No competitor-performance claim is emitted without independently supplied competitor evidence.
