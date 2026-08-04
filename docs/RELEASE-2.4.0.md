# Forge Studio 2.4.0 release notes

## Local AST Intelligence

Forge Studio now includes a compiler-backed AST intelligence layer for JavaScript, TypeScript, JSX, and TSX. TypeScript 5.8.3 is pinned and vendored in the source tree so parsing remains local and source reconstruction does not depend on a package registry.

AST queries support exact syntax kind, exact node name, optional ancestor kind, optional contained text, and bounded result counts. Every result records source range, preview, file hash, node hash, and a content-addressed receipt.

AST patching replaces exactly one matched node. It requires an expected file SHA-256, can also require the selected node SHA-256, supports dry-run, reparses the complete resulting file before writing, denies generated/build output paths, preserves line endings and file mode, and uses a same-directory temporary file followed by atomic rename.

## Governed surfaces

The release adds `code.astQuery` and `code.astPatch` to the Operating Plane and exposes `/api/code/ast-query` and `/api/code/ast-patch`. AST query is available in the default read-only tool set. AST patch is excluded from that set and must be explicitly authorized for a task.

The Codebase Knowledge Center adds an AST Intelligence surface for query, exact-node selection, guarded dry-run, and explicit apply. The interface binds the selected file and node hashes into every patch request.

## Release governance

The required `local-ast-intelligence` gate verifies parser provenance, query bounds, hash evidence, stale guards, syntax rollback, atomic writes, application wiring, API and user interface surfaces, item-level audit mapping, and Full Release Matrix inclusion.

## Audit movement

Exactly two checklist items moved from `not_implemented` to `verified_source_test`:

- 13.26 — Hỗ trợ AST query
- 16.3 — Patch theo AST

The audit total is 632 verified, 91 partial, 52 external-gated, and 15 not implemented out of 790. `13.27 — Hỗ trợ tree-sitter` remains explicitly not implemented.
