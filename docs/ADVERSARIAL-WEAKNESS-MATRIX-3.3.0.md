# Forge Studio 3.3.0 — Adversarial Weakness Matrix

| Area | Adversarial condition | Required behavior | Remaining boundary |
|---|---|---|---|
| Branch facts | A fact is queried from another branch or worktree | Reject with `branch-context-mismatch` | No cross-branch reuse without revalidation |
| Source provenance | File content changes after indexing | Reject with `source-hash-mismatch` | No stale fact promoted as current truth |
| Editor overlays | Unsaved editor content shadows disk content | Store a separate overlay namespace | No mutation of disk-source facts |
| Provider relations | AST/LSP/runtime provider emits no citation | Reject relation and record an unknown | No inferred relation promoted to fact |
| Runtime evidence | Correlation is presented as causality | Accept only cited observation relation | No causal claim without independent evidence |
| Query planning | Git, semantic, or runtime adapter is absent | Mark stage `unavailable` and continue within budget | No fabricated evidence source |
| Viewer cursor | Cursor is altered or reused with another twin/query | Reject cursor | No cross-query page confusion |
| Viewer memory | Repository graph is larger than page limit | Load only the requested page/neighborhood | No whole-graph page claim |
| Integration | Lexical fast path runs | Keep Repository Truth Plane unloaded | No eager `src/app.mjs` wiring |
| Audit | Any item outside the declared 11 changes | Fail release gate | 91 partial and 63 external items remain |
