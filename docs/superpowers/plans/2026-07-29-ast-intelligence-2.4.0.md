# Forge Studio 2.4.0 AST Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver local, evidence-backed AST query and single-node AST patch for JavaScript, TypeScript, JSX, and TSX and close checklist items 13.26 and 16.3.

**Architecture:** Vendor the TypeScript 5.8.3 compiler runtime, wrap it in a strict loader, and build a project-scoped AST service with bounded selectors and hash-guarded atomic patching. Wire the service through Operating Plane, authenticated HTTP, UI, audit, and a required release gate.

**Tech Stack:** Node.js 22 ESM, vendored TypeScript compiler API, existing PathPolicy, node:test, existing release matrix and UI modules.

## Global Constraints

- Support only `.js`, `.mjs`, `.cjs`, `.jsx`, `.ts`, `.mts`, `.cts`, and `.tsx`.
- Keep Tree-sitter checklist item 13.27 open.
- Maximum source size: 2 MiB.
- Maximum replacement size: 256 KiB.
- Maximum query result count: 200.
- Patch requires `expectedSha256` and exactly one selected node.
- No registry, cloud service, language server, or credential is required at runtime.
- Preserve file mode and original line-ending convention.
- Full release validity requires a clean committed tree and every required matrix gate passing.

---

### Task 1: Vendor and load the parser

**Files:**
- Create: `third_party/typescript/LICENSE.txt`
- Create: `third_party/typescript/ThirdPartyNoticeText.txt`
- Create: `third_party/typescript/package.json`
- Create: `third_party/typescript/lib/typescript.js`
- Create: `src/repository/typescript-ast-loader.mjs`
- Test: `tests/typescript-ast-loader.test.mjs`

**Interfaces:**
- Produces: `TypeScriptAstLoader`, `SUPPORTED_AST_EXTENSIONS`, and `parseAstSource({ path, source })` returning `{ compilerVersion, scriptKind, sourceFile, diagnostics }`.

- [ ] Write tests that import the missing loader, assert the pinned compiler version, parse JS/TS/JSX/TSX, reject unsupported extensions, and reject syntax errors.
- [ ] Run `node --test tests/typescript-ast-loader.test.mjs` and observe module-not-found failure.
- [ ] Copy the exact TypeScript 5.8.3 runtime and notices into `third_party/typescript/` and implement the strict loader.
- [ ] Run `node --test tests/typescript-ast-loader.test.mjs` and require all tests to pass.
- [ ] Commit parser provenance and loader.

### Task 2: Implement bounded AST query

**Files:**
- Create: `src/repository/ast-intelligence-service.mjs`
- Test: `tests/ast-intelligence-service.test.mjs`

**Interfaces:**
- Consumes: `parseAstSource({ path, source })`.
- Produces: `AstIntelligenceService.query(input)` with selectors `path`, `nodeType`, `name`, `textContains`, `ancestorType`, and `limit`.

- [ ] Write failing tests for node-kind matching, named declaration matching, ancestor filtering, bounded previews/results, path denial, and receipt hashes.
- [ ] Run `node --test tests/ast-intelligence-service.test.mjs` and observe module-not-found failure.
- [ ] Implement source loading through `PathPolicy`, deterministic traversal, selector normalization, bounded result projection, and receipts.
- [ ] Run `node --test tests/ast-intelligence-service.test.mjs` and require query tests to pass.
- [ ] Commit bounded AST query.

### Task 3: Implement hash-guarded AST patch

**Files:**
- Modify: `src/repository/ast-intelligence-service.mjs`
- Modify: `tests/ast-intelligence-service.test.mjs`

**Interfaces:**
- Produces: `AstIntelligenceService.patch(input)` returning dry-run or applied evidence with `beforeSha256`, `afterSha256`, `nodeSha256`, `replacementSha256`, `changedLines`, `preview`, and `receiptSha256`.

- [ ] Add failing tests for mandatory file hash, stale node hash, ambiguous selection, generated-code denial, dry-run, syntax-error rejection, mode/newline preservation, and atomic apply.
- [ ] Run the focused tests and observe failures because `patch` is absent.
- [ ] Implement exact-one-node selection, replacement bounds, parser revalidation, temporary-file rename, and minimal diff projection.
- [ ] Run the focused tests and require all query and patch cases to pass.
- [ ] Commit AST patch behavior.

### Task 4: Wire Operating Plane, tools, API, and UI

**Files:**
- Modify: `src/agent/operating-plane-service.mjs`
- Modify: `src/agent/operating-plane-tool-gateway.mjs`
- Modify: `src/app.mjs`
- Modify: `src/server/routes.mjs`
- Modify: `ui/codebase-knowledge-center.js`
- Modify: `ui/codebase-knowledge-center.css`
- Modify: `tests/operating-plane-service.test.mjs`
- Modify: `tests/operating-plane-service-completeness.test.mjs`
- Create: `tests/ast-intelligence-http-api.test.mjs`
- Create: `tests/ast-intelligence-app-wiring.test.mjs`
- Create: `tests/ast-intelligence-center-ui.test.mjs`

**Interfaces:**
- Consumes: `AstIntelligenceService` factory.
- Produces: `code.astQuery`, `code.astPatch`, authenticated HTTP operations, and an `AST` Codebase Knowledge Center tab.

- [ ] Add failing runtime, tool-schema, API, application-wiring, and UI tests.
- [ ] Run the focused tests and observe missing operation/factory/tab failures.
- [ ] Add the factory, operations, schemas, application composition, routes, and explicit dry-run/apply UI flow.
- [ ] Run all focused runtime/API/UI tests and require them to pass.
- [ ] Commit runtime and UI wiring.

### Task 5: Add item-level audit and release governance

**Files:**
- Modify: `scripts/audit-feature-checklist.mjs`
- Create: `src/release/ast-intelligence-verifier.mjs`
- Modify: `src/release/full-release-matrix.mjs`
- Create: `scripts/verify-ast-intelligence.mjs`
- Create: `tests/ast-intelligence-release-gate.test.mjs`
- Modify: `tests/full-release-matrix.test.mjs`
- Modify: `docs/LIMITATIONS-2.4.0.md`

**Interfaces:**
- Produces: audit evidence key `astIntelligence`, required matrix gate `local-ast-intelligence`, and `forge.studio.ast-intelligence-verification.v1` receipt.

- [ ] Add failing tests that require only checklist items 13.26 and 16.3 to move to source-and-test verified, while 13.27 remains open.
- [ ] Run the release-gate tests and observe missing verifier/audit/matrix evidence.
- [ ] Implement audit mappings, verifier checks, CLI wrapper, matrix gate, and honest limitations.
- [ ] Run release-gate and matrix tests and require them to pass.
- [ ] Commit release governance.

### Task 6: Version, reports, manifest, and release packages

**Files:**
- Modify all product-version surfaces from `2.3.0` to `2.4.0` as enumerated by version coherence.
- Create: `docs/RELEASE-2.4.0.md`
- Create: `docs/VERIFICATION-REPORT-2.4.0.md`
- Generate: `docs/FEATURE-COMPLETENESS-AUDIT-2.4.0.md`
- Generate: `docs/feature-audit-2.4.0.json`
- Generate: `docs/REMAINING-GAPS-2.4.0.md`
- Generate: `docs/remaining-gaps-2.4.0.json`
- Create: `docs/LIMITATIONS-2.4.0.md`
- Regenerate: `project-manifest.json`
- Generate release archives and checksums.

**Interfaces:**
- Produces: a clean 2.4.0 source tree, Windows/Electron ZIP, update payload, VSIX, evidence archive, SHA-256 list, and current project manifest.

- [ ] Change version surfaces and run the version-coherence verifier.
- [ ] Run focused tests, then all test files in bounded batches, and require zero failures.
- [ ] Run feature audit and remaining-gap generation; verify totals decrease by exactly two verified items and Tree-sitter remains open.
- [ ] Regenerate project manifest, commit the complete tree, and verify `git status --porcelain` is empty.
- [ ] Run Full Release Matrix from gate 1 and require every required gate to pass.
- [ ] Export only files created or changed in this response and update final manifest statuses.
