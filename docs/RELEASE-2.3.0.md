# Forge Studio 2.3.0 release notes

## Local Semantic Search & Dependency Topology

Forge Studio now exposes a local-first semantic retrieval and dependency-topology surface inside the existing Codebase Knowledge Center. Indexing uses the built-in feature-hash embedding provider and the secure semantic index; no hosted embedding service, API key, or external vector database is required.

Semantic results combine semantic similarity with lexical, path, graph, feedback, and test-relation signals. Responses are principal-bound, project-scoped, preview-bounded, and carry content-addressed receipts.

The dependency surface supports incoming, outgoing, and bidirectional traversal; bounded depth and node counts; import-edge evidence; root and leaf detection; per-file degree totals; test-related markers; and strongly connected cycle detection.

## Release governance

The release adds the required `local-semantic-dependency-intelligence` verification gate to the Full Release Matrix. The gate verifies the local embedding provider, hybrid ranking, API authentication, topology bounds, cycle detection, application wiring, user interface, item-level audit mapping, and packaging inclusion.

## Audit movement

Exactly two checklist items moved from `not_implemented` to `verified_source_test`:

- 4.23 — Trình xem dependency graph
- 13.21 — Hỗ trợ semantic search

The audit total is 630 verified, 91 partial, 52 external-gated, and 17 not implemented out of 790. Exact remaining conditions are recorded in `docs/FEATURE-COMPLETENESS-AUDIT-2.3.0.md` and `docs/REMAINING-GAPS-2.3.0.md`.
