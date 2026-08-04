# Forge Studio 1.9.0 release notes

## Codebase Knowledge Graph

Forge Studio 1.9.0 adds a persistent, evidence-bound knowledge graph for repository routes, API endpoints, database models, imports, references, conservative call relationships, tests, and Git history.

The graph is incremental at the extraction layer: unchanged files reuse content hashes and stored entities, changed files are re-extracted, removed files are deleted, and graph edges are deterministically rebuilt from admitted source. A portable watcher observes signature changes and requests incremental refresh with bounded polling and debounce.

Adaptive repository search now exposes graph ranking contributions for dependency distance, Git recency, and test relation. The UI presents these signals rather than collapsing them into an unexplained score.

## Safety and evidence

- Secret, credential, key, binary, symlink, ignored dependency, and oversize paths are excluded.
- Git uses argv-only `execFile`, timeout, and output caps.
- Regex patterns are length-limited, screened for common catastrophic forms, result-limited, and time-budgeted.
- Public entities and edges carry relative paths, lines, detector names, confidence labels, and source hashes.
- Conservative lexical calls are explicitly labelled and are not represented as AST-derived.
- Watchers are explicit resources closed during application shutdown.

## Release gates

The Full Release Matrix adds `codebase-knowledge-graph`, validating source, API, adaptive ranking, UI, tests, watcher lifecycle, and release evidence. The exhaustive Remaining Gaps report remains mandatory in every source artifact.
