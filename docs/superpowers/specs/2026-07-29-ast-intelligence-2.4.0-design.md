# Forge Studio 2.4.0 AST Intelligence Design

## Goal

Add evidence-backed local AST query and AST patch capabilities for JavaScript, TypeScript, JSX, and TSX, closing checklist items 13.26 and 16.3 without claiming Tree-sitter or language-general parsing.

## Scope

The release adds one project-scoped `AstIntelligenceService`, exposes it through the Operating Plane and authenticated HTTP API, adds an AST panel to Codebase Knowledge Center, and adds a fail-closed release verifier and matrix gate.

The parser is the TypeScript 5.8.3 compiler API vendored under `third_party/typescript/`. Runtime operation requires no registry, cloud service, language server, or user credential.

Out of scope:

- Tree-sitter support (13.27 remains `not_implemented`).
- AST support outside JavaScript, TypeScript, JSX, and TSX.
- Cross-file semantic type resolution.
- Automatic formatting or whole-file rewriting.
- Patches that select more than one node.

## Architecture

### Vendored parser loader

`src/repository/typescript-ast-loader.mjs` loads the vendored CommonJS compiler through `createRequire`, pins the accepted compiler version, maps supported extensions to `ScriptKind`, and creates a syntax tree. The loader fails closed for missing vendor files, unsupported extensions, oversized source, and parse diagnostics.

### AST intelligence service

`src/repository/ast-intelligence-service.mjs` owns workspace path policy, source loading, tree traversal, bounded query matching, preview generation, content hashes, and atomic patch writes.

A query request contains:

- `path`
- `nodeType` (TypeScript `SyntaxKind` name, case-insensitive)
- optional `name`, `textContains`, `ancestorType`
- optional `limit` from 1 to 200

Each result contains the node kind, stable path, optional discovered name, start/end offsets, start/end line and column, a bounded preview, source hash, node hash, and a content-addressed receipt.

A patch request contains:

- the same selector fields as a query
- `replacement`
- mandatory `expectedSha256`
- optional `expectedNodeSha256`
- optional `dryRun`

Patch execution requires exactly one match. It rejects generated files, stale file hashes, stale node hashes, ambiguous selectors, unsupported files, NUL bytes, oversized replacements, or replacement text that produces parser errors. It writes through a same-directory temporary file, preserves mode and line endings, and returns before/after hashes plus a minimal textual diff projection.

### Runtime surfaces

Operating Plane adds `code.astQuery` and `code.astPatch`. The tool gateway exposes schemas only when a task allowlist includes these tools. Authenticated HTTP routes expose `/api/operating-plane/code/astQuery` and `/api/operating-plane/code/astPatch` through the existing principal-bound middleware.

Codebase Knowledge Center adds an `AST` tab for selecting a project file, querying nodes, viewing evidence, previewing a patch, and explicitly applying it. The UI never treats a dry-run as an applied edit.

### Release governance

`src/release/ast-intelligence-verifier.mjs` checks parser provenance, bounded selectors, stale-hash guards, atomic writes, runtime/API/UI wiring, direct tests, item-level audit mappings, limitations, and matrix inclusion. The Full Release Matrix adds a required `local-ast-intelligence` gate.

## Data and trust boundaries

- Workspace paths pass through `PathPolicy`; traversal and symlink escape remain denied.
- Query and patch results are project-scoped and contain no source outside the selected file.
- Previews are bounded to 1,200 characters.
- File size is capped at 2 MiB; replacement size is capped at 256 KiB.
- Query matches are capped at 200.
- Patch requires a caller-supplied file hash and one exact node.
- No model-authored claim is accepted as evidence; the receipt is derived from actual file content and operation data.

## Testing

Direct tests cover loader provenance, JS/TS/JSX/TSX parsing, bounded query selectors, ancestor filtering, stale and ambiguous patch rejection, generated-code denial, dry-run, syntax-validation rollback, atomic apply, Operating Plane/tool schemas, authenticated HTTP routing, UI controls, audit transition for only items 13.26 and 16.3, release verifier behavior, and Full Release Matrix inclusion.

The release is valid only after the full Node suite and Full Release Matrix pass from gate 1 on a clean committed tree.
