# Forge Studio 1.0 Adaptive Agent Intelligence Design

## Decision

Forge Studio 1.0 will add one shared **Adaptive Intelligence Plane** rather than copying isolated product features. The plane is local-first and provider-agnostic. Desktop, CLI, IDE extensions, SDKs, subagents, and future cloud drivers consume the same typed services and evidence receipts.

The implementation is divided into seven independently testable capabilities:

1. Secure incremental code intelligence.
2. Dynamic context and dynamic tool discovery.
3. Cache-aware model routing and outcome feedback.
4. Project-scoped memory proposals with evidence and expiry.
5. Independent incremental review.
6. Durable local automations.
7. Visual/DOM design context and reproducible source releases.

Cloud-only behavior is represented by driver contracts but is never reported as production-complete without a real remote environment.

## 1. Secure incremental code intelligence

`SecureSemanticIndex` builds a Merkle tree over allowed repository files, splits text into syntactic chunks, caches embeddings by content hash, and updates only changed chunks. The initial query surface becomes available after repository structure and lexical chunks are ready; embeddings may finish incrementally.

Search combines:

- exact/regex lexical matches;
- semantic similarity from a pluggable embedding provider;
- symbol and import graph rank;
- task/path/language/test proximity boosts;
- recency and prior successful retrieval feedback.

The built-in offline embedding is deterministic feature hashing, not marketed as a learned neural embedding. Providers may register a real coding embedding model through the same interface. Search results always include path, line range, content hash, index root, scoring breakdown, and provenance.

Reusable snapshots are content-addressed. A consumer must present the current Merkle leaf hash for every returned file. A snapshot never returns a chunk without a matching local content proof.

## 2. Dynamic context and tool discovery

`DynamicContextStore` writes oversized terminal, browser, MCP, and hook output into immutable artifact files instead of truncating it. The model receives a bounded preview, hash, byte count, and paging/search instructions. Conversation and terminal transcripts use the same mechanism so compaction does not destroy access to original evidence.

`DynamicToolCatalog` keeps only compact tool summaries in the base prompt. Full JSON schemas are loaded by name immediately before use. Core file/search/patch/terminal tools remain pinned; uncommon MCP/plugin tools are progressively disclosed.

`ContextPlanner` selects context under separate planner, executor, reviewer, and debugger budgets. It records why every item was selected or rejected.

## 3. Cache-aware model router

`AdaptiveModelRouterV2` classifies requests into exploration, planning, editing, debugging, review, UI/vision, retrieval, and mechanical execution. It supports `intelligence`, `balanced`, and `cost` policies.

Ranking includes capability fit, quality, latency, price, local/offline preference, health, prompt-cache continuity, expected tool-use reliability, and historical outcome feedback. Feedback is based on verified task completion, accepted diff ratio, code retention, user correction, and cost—not self-reported model success.

Routing is explainable and deterministic for equal inputs. Explicit user/provider overrides remain authoritative unless blocked by policy or unavailable.

## 4. Evidence-backed memory sidecar

`MemorySidecar` observes completed task receipts and proposes small project-scoped memories. It never activates them automatically. Each candidate contains citations to repository paths or receipts, confidence, expiry, and a revalidation strategy.

Activation requires user approval. Retrieval revalidates content hashes and marks stale memories when evidence changes or TTL expires. Rules and memories remain separate namespaces with explicit priority.

## 5. Independent incremental review

`IndependentReviewService` creates a reviewer context that excludes executor hidden state. It reviews the current diff plus retrieved surrounding code, project rules, diagnostics, tests, and security findings.

A canonical diff fingerprint deduplicates repeated review. Incremental review analyzes only changes since the last reviewed fingerprint while preserving unresolved findings. Findings have stable IDs, severity, exact location, evidence, suggested verification, and disposition.

The reviewer cannot mark a task complete. It may only produce findings and a signed review receipt.

## 6. Durable local automations

`LocalAutomationService` stores schedules and event filters in SQLite, claims runs with fencing tokens, creates a fresh task/worktree contract, and produces a report or reviewable branch. It does not deploy or push without a separate capability grant.

Supported triggers in 1.0 are interval/calendar expressions resolved locally and explicit repository events submitted through the API. External GitHub/Slack/Linear/PagerDuty webhooks remain adapters behind authenticated endpoints.

## 7. Design context and release reproducibility

`DesignContextService` captures a browser screenshot together with selected DOM nodes, bounding boxes, accessible names, computed style summaries, source hints, and screenshot hashes. Requests may express relationships between multiple selected nodes. The service is read-only; editing still passes through normal file/patch permissions.

The release matrix adds a fresh-source reconstruction gate. It extracts the source archive into an empty directory, verifies `vendor/forge-os` against its manifest, runs representative tests, rebuilds the VS Code extension, and rejects hidden or untracked build dependencies.

## Security and privacy

- Secret paths, binary files, ignored directories, and denied paths never enter the index.
- Embedding providers receive only explicitly allowed chunks.
- Snapshot reuse requires per-file content proof.
- Tool schemas do not grant permission; capability checks still run at execution.
- Artifactized output is redacted before disk write and stored under task-owned directories.
- Memory candidates cannot become active without approval.
- Review, automation, and design services cannot bypass the capability registry.
- Every mutation and externally supplied result is attached to a hash receipt.

## Error handling

Every service fails closed with typed errors and machine-readable reason codes. Partial indexing remains queryable but reports completeness. Corrupt Merkle snapshots, artifact hashes, memory evidence, review fingerprints, and automation leases are rejected rather than silently repaired.

## Verification

Each capability follows red-green-refactor tests. Release requires the complete repository matrix, including Node tests, syntax, authenticated smoke, ForgeOS validation/TCK/mutation, Go, Python, IDE build, feature audit, benchmark claim lock, packaging, archive integrity, and fresh-source reconstruction. A failed gate requires a full matrix rerun from the beginning.
