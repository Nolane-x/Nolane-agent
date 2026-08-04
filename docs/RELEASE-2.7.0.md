# Forge Studio 2.7.0 release notes

## Code Relationship Intelligence

Forge Studio now builds a local relationship index from the existing repository knowledge graph and the vendored TypeScript 5.8.3 compiler AST. `CodeRelationshipIntelligenceService` records class and interface declarations, `extends` and `implements` edges, explicit unresolved evidence, contextual issue references, and Git commit-to-changed-file issue links in dedicated SQLite tables.

## Inheritance graph

The inheritance index supports JavaScript, TypeScript, JSX, and TSX. Parent resolution follows a bounded and explainable order: same-file declaration, relative import target, then a unique project-wide declaration. Ambiguous or missing parents remain unresolved with a reason and source location; Forge Studio does not fabricate an edge.

Each declaration and edge carries its path, line, detector, confidence, source digest, resolution method, and content-addressed receipt. Query depth, direction, and result count are bounded.

## Local issue-to-code index

Issue references are accepted only when a contextual keyword such as `fixes`, `closes`, `resolves`, `refs`, `issue`, or `ticket` precedes a supported issue key. Numeric literals, headings, ports, and unrelated hash tokens are not treated as issue truth.

Source and documentation references are bound to file and line evidence. Git commit references are bound only to files reported as changed by that exact local commit. The feature does not call GitHub, Jira, or any remote issue provider.

## Authenticated API and Knowledge Center

The HTTP surface exposes authenticated index, inheritance, and issue endpoints. Requests can select only a project already known to Forge Studio and bounded query filters; they cannot supply a workspace root, credential, token, or remote provider.

The Codebase Knowledge Center adds `Inheritance` and `Issue Links` tabs, including resolved edges, unresolved evidence, source locations, commit hashes, detector/confidence labels, and receipt hashes.

## Release governance

The required `code-relationship-intelligence` gate verifies compiler-backed extraction, same-file and relative-import resolution, ambiguous/unresolved evidence, contextual issue parsing, commit-to-file binding, authenticated bounded APIs, UI evidence, item-level audit movement, explicit non-claims, and Full Release Matrix inclusion.

## Audit movement

Exactly two checklist items moved from `not_implemented` to `verified_source_test`:

- 13.15 — Lập chỉ mục inheritance graph
- 13.19 — Lập chỉ mục issue liên quan

The audit total is 641 verified, 91 partial, 52 external-gated, and 6 not implemented out of 790. Integrated browser, secrets manager, Tree-sitter, Podman, Windows Job Objects, and macOS sandbox support remain explicitly not implemented.
