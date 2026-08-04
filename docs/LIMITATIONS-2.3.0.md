# Forge Studio 2.3.0 — remaining limits

The item-level source of truth is `docs/feature-audit-2.3.0.json`. The exhaustive open-item report is `docs/REMAINING-GAPS-2.3.0.md`.

## Semantic-search boundaries

The built-in embedding provider is deterministic and local, but it is a feature-hash embedding rather than a large learned embedding model. It is suitable for private, zero-cost local retrieval but does not imply parity with hosted provider embeddings. Ranking quality depends on indexed source quality and the current hybrid scoring signals.

Semantic results expose bounded excerpts rather than complete files. A passing release gate proves implementation and direct automated tests; it does not constitute independent comparative certification.

## Dependency-topology boundaries

The dependency viewer projects evidence already extracted by Forge Studio, primarily import edges and test relations. It is not a language-general build graph, runtime trace graph, complete inheritance graph, or proof that every dynamic dependency was discovered. Traversal is intentionally bounded to 500 nodes, depth 8, and 2,000 rendered edges.

## Code-intelligence boundaries

Forge Studio still does not claim Tree-sitter incremental parse trees, general AST queries, language-general AST patching, a complete inheritance graph, or issue/PR-to-code indexing. Those checklist items remain open unless their item-level audit status changes.

## Platform and production boundaries

Native OS isolation parity, Authenticode, Apple notarization, live enterprise IdP/SCIM conformance, hosted cloud conformance, marketplace approval, and independent comparative benchmarks require external infrastructure or evidence. Exact completion conditions for every open item are listed in `docs/REMAINING-GAPS-2.3.0.md`.
