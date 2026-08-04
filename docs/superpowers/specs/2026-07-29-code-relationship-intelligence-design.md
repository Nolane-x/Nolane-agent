# Code Relationship Intelligence 2.7.0 Design

## Goal

Add local, evidence-bound inheritance graph and issue-to-code indexing without cloud APIs, remote credentials, or language-general claims.

## Scope

The release closes checklist items 13.15 (inheritance graph indexing) and 13.19 (related issue indexing). It does not claim Tree-sitter, GitHub/Jira synchronization, remote issue truth, or inheritance coverage beyond JavaScript/TypeScript/JSX/TSX.

## Architecture

A focused `CodeRelationshipIntelligenceService` consumes the durable `codebase_knowledge_files` index and the project workspace Git history. It stores relationship nodes and edges in dedicated SQLite tables so indexing is deterministic, queryable, principal-bound, and independent from UI state.

Inheritance extraction uses the vendored TypeScript 5.8.3 compiler AST. It records class/interface declarations and `extends`/`implements` clauses. Resolution order is same-file declaration, exact relative named import, then a unique project-wide declaration. Unresolved external or ambiguous bases remain explicit evidence with `resolved=false`; they never become false local edges.

Issue extraction uses only local evidence. It recognizes contextual references such as `fixes #123`, `closes owner/repo#123`, `refs GH-42`, `issue ABC-123`, and equivalent references in Git commit subjects/bodies. Bare numbers are ignored. Git-linked issues are mapped to changed files from the same commit; source-linked issues are mapped to the exact file and line.

## Data contracts

- `forge.code-relationship-index.v1`: counts, changed paths, compiler identity, graph hash, receipt.
- `forge.inheritance-graph.v1`: principal/project, bounded nodes and edges, unresolved references, graph hash, receipt.
- `forge.issue-code-index.v1`: principal/project, issue nodes, file relations, local evidence, graph hash, receipt.

Every item includes detector, confidence, source path or commit hash, line where available, and content-addressed SHA-256 evidence.

## API and UI

Authenticated endpoints:

- `POST /api/code-relationships/index`
- `GET /api/code-relationships/inheritance`
- `GET /api/code-relationships/issues`

The Codebase Knowledge Center gains `Inheritance` and `Issue Links` tabs. Indexing local intelligence refreshes semantic/dependency and relationship indexes together. No endpoint accepts arbitrary filesystem roots or remote provider tokens.

## Failure and safety behavior

Unknown projects, missing principals, invalid limits, unsafe paths, malformed issue filters, and unavailable indexed content fail closed. Git history failure degrades only commit-derived issue links and is reported in the index result; source-derived relationships remain usable.

## Verification

TDD covers AST extraction, alias imports, ambiguous/unresolved bases, issue parsing false positives, commit-to-file links, principal/project binding, API contracts, app wiring, UI tabs, audit movement, release verifier, source reconstruction, and Full Release Matrix inclusion.
