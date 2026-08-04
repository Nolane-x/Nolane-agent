# Forge Studio 2.1.0 — remaining limits

The item-level source of truth is `docs/feature-audit-2.1.0.json`. The exhaustive open-item report is `docs/REMAINING-GAPS-2.1.0.md`.

## Context boundaries

The Context Orchestration Kernel estimates tokens using a deterministic character-based estimator; provider-specific tokenizers can be added later without changing the policy interface. Compaction is deterministic and evidence-preserving, but it is not a claim that every possible semantic detail survives compression. Original artifacts remain accessible through content-addressed references.

## Code intelligence boundaries

Forge Studio still does not claim Tree-sitter incremental parse trees, general AST queries, language-general AST patching, a complete inheritance graph, issue/PR-to-code indexing, or independent certification of provider-backed semantic embeddings unless the audit explicitly changes those items.

## Platform and production boundaries

Native OS isolation parity, Authenticode, Apple notarization, live enterprise IdP/SCIM conformance, hosted cloud conformance, marketplace approval, and independent comparative benchmarks require external infrastructure or evidence. Exact completion conditions for every open item are listed in `docs/REMAINING-GAPS-2.1.0.md`.
