# Forge Studio 1.9.0 — remaining limits

The item-level source of truth is `feature-audit-1.9.0.json`. The exhaustive open-item report is `REMAINING-GAPS-1.9.0.md`.

## Code intelligence boundaries

The 1.9.0 graph deliberately does not claim:

- Tree-sitter parsing or incremental parse trees.
- General AST queries or language-general AST patching.
- A complete inheritance graph.
- Issue/PR-to-code indexing.
- Provider-backed semantic embedding certification.

Reference and call edges are conservative lexical evidence. Language-server definitions/references remain a separate, higher-confidence service where an LSP is configured.

## External production gates

Native OS isolation parity, hosted-provider conformance, production cloud/identity operation, public signing/notarization, and independent comparative benchmarks remain evidence-bound external gates where applicable. The exact completion condition for every open item appears in `REMAINING-GAPS-1.9.0.md`.
