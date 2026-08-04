# Local Semantic Search & Dependency Graph 2.3.0 Design

## Goal

Promote Forge Studio's existing local hybrid repository search into a principal-bound, evidence-receipted product surface and add a dedicated dependency graph viewer that can explain incoming, outgoing, cyclic, test, and impact relationships without cloud services.

## Scope

This component closes exactly two currently unimplemented checklist items:

- **4.23 — Trình xem dependency graph**
- **13.21 — Hỗ trợ semantic search**

It does not claim Tree-sitter, AST queries, AST patching, issue-provider indexing, native OS sandbox parity, or provider-backed embedding certification.

## Architecture

`SemanticDependencyIntelligenceService` composes the existing `AdaptiveRepositoryIntelligence`, `CodebaseKnowledgeGraphService`, and `StudioStore`. It never reads arbitrary paths from clients. Every operation resolves a durable project by ID, requires an authenticated principal ID, and returns bounded data plus a canonical SHA-256 receipt.

The service exposes three operations:

1. `indexProject` runs the existing lexical, local feature-hash semantic, and knowledge-graph indexes together.
2. `search` returns hybrid semantic/lexical/graph-ranked chunks with bounded previews, line ranges, score breakdowns, source labels, index state, and a query fingerprint.
3. `dependencies` projects import and test-relation edges into a file graph, optionally centered on one root path. It calculates incoming/outgoing degree, roots, leaves, strongly connected cyclic components, bounded neighborhoods, and an evidence receipt.

## Data boundaries

- Secret-like files remain excluded by the existing semantic and graph admission policies.
- Absolute workspace paths, environment values, credentials, prompts, and unrestricted file contents are never returned.
- Search previews are bounded to 1,200 characters per result.
- Dependency results are bounded to 500 nodes and 2,000 edges.
- Root paths must match an indexed relative file path exactly.
- Unknown projects, missing principals, empty queries, invalid direction, and out-of-range limits fail closed with stable error codes.

## HTTP surface

Authenticated routes:

- `POST /api/semantic-dependency/index`
- `POST /api/semantic-dependency/search`
- `GET /api/semantic-dependency/graph`

The graph route accepts `projectId`, optional `rootPath`, `direction` (`incoming`, `outgoing`, or `both`), `depth` (0–8), and `limit` (1–500).

## UI

The lazy-loaded Codebase Knowledge Center gains two dedicated tabs:

- **Semantic Search**: query, language, and path-prefix filters; result cards show line range, source badges, score, score breakdown, and receipt.
- **Dependencies**: root-file focus, direction, and depth controls; a three-lane incoming/focus/outgoing topology, degree metrics, cycles, roots/leaves, typed evidence edges, and receipt.

The existing incremental index action is upgraded to index lexical, semantic, and graph state together.

## Verification

TDD must prove:

- principal and project fail-closed behavior;
- local semantic retrieval for conceptually related text;
- bounded redacted result contracts and deterministic receipts;
- dependency neighborhood traversal in all directions;
- cycle, root, leaf, and degree calculation;
- HTTP route wiring and authentication context propagation;
- UI controls and dedicated graph/search rendering;
- feature-audit promotion of only items 4.23 and 13.21;
- a new required release gate;
- source reconstruction, package coherence, and a clean full release matrix.
