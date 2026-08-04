# Forge Studio 3.3.0 Repository Truth Plane Design

## Decision

Forge Studio 3.3.0 completes the eleven P0 Repository Digital Twin requirements `32.2`, `32.3`, `32.4`, `32.7`, `32.9`, `32.10`, `32.11`, `32.12`, `32.15`, `32.17`, and `32.18` without changing any external gate or comparative-superiority claim.

The design extends the existing `RepositoryDigitalTwinService` through focused components rather than replacing it. The existing bounded twin remains the compatibility surface; the new Truth Plane adds branch-scoped facts, richer maps, a staged query planner, and a paged viewer API.

## Architecture

### 1. Branch-scoped fact ledger

`RepositoryFactLedger` stores immutable facts with:

- project, branch, worktree, head SHA, dirty hash, editor-overlay hash;
- citation path, line/span, and source SHA-256;
- fact kind, subject, predicate, object, provenance provider, confidence;
- invalidation key derived from the complete branch context and citation.

Facts are returned only when the current branch context matches and their citations still resolve to the same source hash. Cross-branch reuse is rejected, not silently downgraded. Unsaved editor buffers live in an overlay namespace and never overwrite disk facts.

### 2. Architecture, symbol, and runtime maps

`RepositoryTruthMapBuilder` converts repository index, semantic imports, symbols, package/config metadata, relationship-provider edges, runtime observations, and editor overlays into three bounded maps:

- Architecture Map: public/internal APIs, services, layers, domain boundaries, schemas, configuration, build targets, and external dependencies.
- Symbol Map: definitions, references, callers, types, implementations, and verifying tests.
- Runtime Map: requests, events, processes, state transitions, data flow, reads, writes, and controls.

Every inferred edge carries a citation and source-hash invalidation key. Missing evidence is represented as an explicit unknown, never as an inferred fact.

### 3. Evidence query planner

`RepositoryEvidenceQueryPlanner` executes providers in this fixed order:

`exact → lexical → AST/LSP → graph → Git → test → semantic → runtime`

Each stage receives a remaining budget, may return cited results and unknowns, and may stop the plan only when its acceptance threshold is met. A stage that is unavailable is recorded as unavailable; it is never represented as having returned no matches.

### 4. Paged viewer and zoom API

`RepositoryTruthViewer` materializes compact page descriptors and supports zoom levels:

`workspace → domain/layer → service/package → file → symbol → source span`

The viewer loads only the requested page and its bounded neighborhood. Responses include `loadedNodeCount`, `totalNodeCount`, `nextCursor`, and `truncated`, making memory behavior directly testable.

### 5. Integration

`RepositoryDigitalTwinService` emits schema `forge.repository-digital-twin.v2` while preserving all v1 fields. It delegates to the new ledger/maps/viewer and exposes:

- `build(projectId, options)`
- `query(projectId, request)`
- `zoom(projectId, request)`
- `validateFacts(projectId, branchContext)`

`RepositoryIntelligenceFabric` creates these services lazily. Existing lexical and repository fast paths must not initialize the Truth Plane.

## Data flow

1. Repository index provides file content/hash and symbols.
2. Git/editor adapters provide branch, worktree, dirty state, and unsaved overlays.
3. Relationship/runtime providers contribute cited observed edges.
4. Map builder creates cited nodes/edges and writes facts to the ledger.
5. Query planner retrieves evidence in the fixed stage order.
6. Viewer pages the resulting twin without loading the entire graph.
7. Release measurement executes the production adapters on a real temporary Git repository and records a content-addressed receipt.

## Failure and safety behavior

- Citation hash mismatch: fact is invalid and omitted with reason `source-hash-mismatch`.
- Branch/worktree mismatch: fact is rejected with reason `branch-context-mismatch`.
- Unsaved overlay mismatch: disk fact remains intact; overlay fact expires.
- Missing provider: query stage records `unavailable`; no fake evidence is generated.
- Ambiguous inference: result status is `ambiguous` and cannot be promoted to a fact.
- Budget exhausted: response is bounded and marked `truncated`.
- Corrupt cursor/page token: fail closed with a typed error.

## Tests and release evidence

The implementation uses RED→GREEN tests for each component, an integration test using a real temporary Git repository and real indexed source files, and a release gate that verifies:

- deterministic measurement receipt;
- exactly eleven audit transitions from `partial` to `verified_source_test`;
- audit summary `996 verified_source_test / 91 partial / 63 external_gate / 0 not_implemented`;
- external gate count unchanged;
- no comparative-superiority claim;
- full release matrix contains required gate 72 `repository-truth-plane`.

## Non-claims

This release does not claim complete language coverage, perfect runtime causality, production validation on every operating system, cloud-backed indexing, or superiority over Cursor/Codex/Claude. Runtime relations are only verified when an observed runtime provider supplies cited evidence.
