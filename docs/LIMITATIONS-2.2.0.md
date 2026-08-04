# Forge Studio 2.2.0 — remaining limits

The item-level source of truth is `docs/feature-audit-2.2.0.json`. The exhaustive open-item report is `docs/REMAINING-GAPS-2.2.0.md`.

## Mission-state boundaries

Cost totals are evidence-based only when providers or task records report usage. A missing provider price is not guessed. Progress milestones are intentionally conservative: tool-call volume alone never counts as progress. Repository identity is a stable public digest, not a remote-host identity proof. Sandbox state is an allowlisted health projection and does not imply native OS isolation parity.

## Code intelligence boundaries

Forge Studio still does not claim Tree-sitter incremental parse trees, general AST queries, language-general AST patching, a complete inheritance graph, issue/PR-to-code indexing, or independent certification of provider-backed semantic embeddings unless the audit explicitly changes those items.

## Platform and production boundaries

Native OS isolation parity, Authenticode, Apple notarization, live enterprise IdP/SCIM conformance, hosted cloud conformance, marketplace approval, and independent comparative benchmarks require external infrastructure or evidence. Exact completion conditions for every open item are listed in `docs/REMAINING-GAPS-2.2.0.md`.
