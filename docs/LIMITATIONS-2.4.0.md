# Forge Studio 2.4.0 — remaining limits

The item-level source of truth is `docs/feature-audit-2.4.0.json`. The exhaustive open-item report is `docs/REMAINING-GAPS-2.4.0.md`.

## AST language boundary

AST query and patch support only JavaScript, TypeScript, JSX, and TSX extensions recognized by the pinned TypeScript 5.8.3 compiler. Forge Studio does not claim language-general AST support, Tree-sitter incremental parse trees, Tree-sitter queries, or Tree-sitter edit propagation in this release.

## AST selection boundary

Queries use TypeScript `SyntaxKind`, exact optional names, ancestor kinds, and text containment. They do not implement an arbitrary structural query language. Patch application requires exactly one match; zero matches and ambiguous matches fail closed.

## AST mutation boundary

AST patch replaces a complete selected node rather than synthesizing arbitrary transformations. It requires a current file hash, supports an optional node hash, rejects generated/build output paths, reparses the resulting file, and writes atomically. Syntax validity does not prove semantic correctness, type correctness, formatting quality, or passing tests; those remain separate verification steps.

## Dependency and production boundaries

A passing local release gate proves the implementation and direct automated tests present in this source tree. It is not independent comparative certification. Native OS isolation parity, Authenticode, Apple notarization, live enterprise IdP/SCIM conformance, hosted cloud conformance, marketplace approval, and independent benchmarks still require external infrastructure or evidence.
