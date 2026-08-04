# Codebase Knowledge Graph 1.9.0 Design

## Goal

Close the directly implementable partial requirements in checklist section 13 without mislabeling lexical analysis as AST, semantic-provider indexing, or Tree-sitter.

## Architecture

`CodebaseKnowledgeGraphService` owns a persistent SQLite knowledge graph derived from repository files already admitted by Forge's secret/binary/size policy. It records typed entities (routes, API endpoints, database models, symbols), typed edges (imports, references, conservative calls, test relations), bounded Git history, and per-file content hashes. Extraction is detector-labelled and line-evidenced; conservative lexical call edges carry lower confidence and never claim AST precision.

`CodebaseKnowledgeWatcher` provides portable polling with explicit start/stop, debouncing, bounded scans, content-hash comparison, and project isolation. It invokes incremental indexing only when file signatures change.

`AdaptiveRepositoryIntelligence` consumes the graph as a ranking signal. Search results expose a score breakdown for dependency distance, Git recency, and test relationship. Existing lexical and semantic retrieval remain independent evidence sources.

An authenticated HTTP API and lazy Codebase Knowledge Center expose graph summaries, route/API/model indexes, references/calls, Git history, regex search, watcher state, and ranking explanations. Browser payloads use an explicit allowlist and never include full file contents, credentials, local absolute paths, or command environments.

## Safety and truthfulness

- No Tree-sitter, AST-query, inheritance-graph, issue-index, or provider-backed semantic claim is made by this component.
- Regex execution is bounded by pattern length, result count, file count, and elapsed-time checks; invalid patterns fail closed.
- Git commands use `execFile` argv, no shell, timeout, and output caps.
- Secret paths, binary files, oversize files, ignored dependencies, symlinks, and paths outside the workspace are excluded.
- Every entity and edge includes relative path, line, detector, confidence, and source SHA-256 where applicable.
- Watchers are explicit resources closed during application shutdown.

## Release evidence

Release 1.9.0 adds a `codebase-knowledge-graph` gate. The gate builds a fixture repository and proves route/API/model indexing, references, conservative call edges, bounded regex, incremental reuse/change detection, watcher refresh, Git-history indexing, dependency-distance ranking, Git-recency ranking, test-related ranking, authenticated API, lazy UI, source packaging, and exhaustive Remaining Gaps reporting.
