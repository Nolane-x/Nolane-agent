# Evidence Context Runtime 2.15.0 Design

## Decision

Build one local-only evidence runtime that connects the existing repository intelligence, context orchestration, trace receipts, project memory, subagents, and recovery loop. The runtime does not replace those components. It gives them a shared, durable model for provenance, counter-evidence, leases, structured context packets, and recovery decisions.

## Goals

1. Store evidence as typed nodes and typed relations instead of a flat chunk list.
2. Retrieve across lexical, semantic, structural, runtime, and historical sources with Reciprocal Rank Fusion.
3. Decompose a user objective into bounded tool-specific queries before retrieval.
4. Build a structured context packet containing supporting evidence and counter-evidence.
5. Expire context when source files, tests, plans, or dependencies change.
6. Compact long transcripts and tool output losslessly by keeping the full content in the existing DynamicContextStore and placing only a summary plus references in the graph.
7. Require evidence before a fact can be proposed to project memory through this runtime.
8. Require structured subagent handoffs with findings, evidence, rejected hypotheses, uncertainty, and a next action.
9. Detect stale, incomplete, repetitive, or non-progressing context and produce a bounded recovery plan.
10. Inject the packet into AgentLoop as a governed reference before the model is called.

## Non-goals

- No remote vector database or cloud graph service.
- No claim that deterministic query decomposition fully understands every natural-language objective.
- No hidden chain-of-thought storage.
- No automatic mutation from retrieval or recovery output.
- No replacement of the existing verification gates or completion receipts.
- No permanent validity for retrieved evidence.

## Architecture

### EvidenceGraphRuntimeService

A SQLite-backed service owns project-scoped nodes, edges, leases, invalidations, compactions, and audit records.

Node types are bounded to:
`Requirement`, `File`, `Symbol`, `Function`, `Class`, `Test`, `Error`, `Command`, `Decision`, `Patch`, `ToolOutput`, `Memory`, `Hypothesis`, `Dependency`, and `Document`.

Relation types are bounded to:
`imports`, `calls`, `defines`, `implements`, `tested_by`, `failed_with`, `changed_by`, `depends_on`, `contradicts`, `supersedes`, `proves`, `supports`, and `refutes`.

Every node carries project scope, source kind/reference/hash, source version, creator, confidence, validity condition, status, timestamps, and a canonical receipt. Edges carry the same provenance discipline.

### HybridEvidenceRetrievalService

The service accepts five retriever adapters:

- lexical
- semantic
- structural
- runtime
- historical

For each decomposed query, each source returns a ranked list. Results are normalized and fused with:

`sum(1 / (60 + rank))`

The runtime then reranks with graph distance, freshness, runtime evidence, and duplicate penalties. Counter-evidence retrieval is always run when a hypothesis is supplied.

### Query decomposition

A deterministic decomposer extracts:

- exact symbols and paths;
- error strings and status codes;
- implementation concepts;
- middleware/storage/config/test variants;
- historical failure queries;
- counter-evidence queries.

Output is bounded to twelve queries and each query declares a preferred retrieval source.

### ContextPacketRuntimeService

The packet schema contains:

- goal
- current state
- constraints
- current plan step
- evidence
- counter-evidence
- relevant symbols
- recent failures
- available tools
- completion criteria
- omissions
- lease summary

The existing ContextOrchestrationKernel enforces the role token budget and deduplication. Every evidence item includes its source, source hash, retrieval reason, confidence, lease condition, and graph node ID.

### Lossless compaction

Full content is written to DynamicContextStore. The graph receives a compact Decision or ToolOutput node containing the summary, unresolved items, evidence references, and artifact ID. The summary is never the sole copy of the original content.

### Memory and subagents

Evidence-backed memory proposals require at least one active evidence node. The runtime passes citations and a graph receipt into ProjectMemorySidecar.

Subagent outputs must use:

- task
- findings
- evidence
- files examined
- hypotheses rejected
- remaining uncertainty
- recommended next action

Evidence references must resolve to active graph nodes.

### Context-aware recovery

The recovery analyzer consumes recent tool calls, test outcomes, graph changes, stale-context count, and rejected hypotheses. It reports progress from state changes and evidence, not token or step counts. Recovery actions may invalidate stale context, expand graph-neighbor retrieval, delegate an independent investigation, switch hypothesis, or request rollback. It cannot execute those actions itself.

## Security and scope

- All methods require a known project and authenticated principal.
- User requests never provide a raw workspace root.
- Secret-like values are rejected or redacted before persistence.
- Graph and retrieval limits are hard bounded.
- Invalidation and recovery are append-audited.
- Only active nodes are returned by default.

## API

- `POST /api/evidence-runtime/index`
- `POST /api/evidence-runtime/retrieve`
- `POST /api/evidence-runtime/packet`
- `POST /api/evidence-runtime/invalidate`
- `POST /api/evidence-runtime/compact`
- `POST /api/evidence-runtime/memory`
- `POST /api/evidence-runtime/subagent/validate`
- `POST /api/evidence-runtime/audit`
- `POST /api/evidence-runtime/recover`
- `GET /api/evidence-runtime/graph`

All routes derive the principal from the authenticated request.

## AgentLoop integration

Before `forge.buildContextPack`, AgentLoop asks the runtime for one structured packet. The packet is inserted as a high-priority governed reference. Runtime failure is fail-open only for availability: the agent may continue with existing context, but an omission event is recorded. Scope, integrity, or secret failures remain fail-closed.

## Verification

Direct tests cover:

- node and edge provenance;
- RRF ranking across five sources;
- counter-evidence retrieval;
- query decomposition;
- lease invalidation;
- token-budgeted packets;
- lossless compaction references;
- evidence-backed memory;
- structured subagent validation;
- context auditing and recovery;
- API principal scoping;
- AgentLoop packet injection;
- release gate and source reconstruction.
