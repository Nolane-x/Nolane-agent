# ForgeOS v0.6 Deterministic Skill Intelligence Architecture

ForgeOS is a provider-neutral control plane for trusted AI agents. The model is responsible for judgment; ForgeOS is responsible for state, authority, scope, context, deterministic execution, evidence, recovery, and release eligibility.

## Current architecture

```text
confirmed intent or failed gate
  → Unified Skill Intelligence Router
  → frozen RoutePlan
  → Global Context Kernel v2
  → isolated ContextPack per work unit
  → Deterministic Execution Graph
  → anchored outputs + fenced Coverage Ledger
  → independent reflection
  → trusted receipts and Trust Kernel gates
  → artifact, release, rollback, recovery, or learning quarantine
```

### 1. Outcome, technique, provider, evaluator

ForgeOS keeps four identities separate:

- **Outcome scaffold:** one of 1,024 typed result contracts inherited from v0.4.
- **Deep technique:** one of 128 Skill Contract v2 procedures in v0.6: 32 L0 and 96 L1.
- **Provider:** a first-party or federated implementation of a technique, knowledge reference, or MCP tool.
- **Evaluator:** an independent contract that checks artifacts, evidence, and behavior.

The 1,024 outcome nodes are not counted as production-grade procedural skills. Current provider maturity is 33 stable procedural providers and 242 candidates.

### 2. Unified Skill Intelligence Router

The router combines direct trigger retrieval with outcome-graph retrieval. It applies anti-triggers, tenant policy, maturity, license, source freshness, required tools, evidence obligations, segmented utility, conflict cost, and context cost before composing the smallest technique DAG. Every selected and rejected technique receives a reason. A RoutePlan is frozen by hash and becomes stale when its semantic inputs change.

### 3. Global Context Kernel v2

The compiler owns one request-wide budget for system policy, task, selected skill sections, code, artifacts, memory, tool output, references, lazy tool schemas, output reserve, and safety reserve. It emits an omission manifest for every excluded source. Work units receive isolated contexts. Symbol bodies are fetched through Semantic ABI IDs and expected hashes; stale symbols are rejected.

### 4. Deterministic Skill Fabric

A technique is compiled into typed nodes:

- deterministic nodes for scope, bundling, rules, anchoring, and evidence;
- agent nodes for investigation and domain judgment;
- reflection nodes for contradiction, false-positive filtering, and actionability;
- control nodes for parallel joins, gates, retries, rollback, and cancellation.

The Coverage Ledger uses leases, heartbeat, fencing, and trusted receipts. A reclaimed worker cannot complete a work unit. The Code Review Intelligence pack is the first end-to-end vertical slice.

### 5. Continuous Learning and harness runtime

Observed patterns enter an append-only Instinct Store with tenant, project, user, harness, trust-domain, confidence, and expiry. Clustering can propose a candidate evolution, but it cannot edit a stable skill. Promotion requires independent evaluation and an authorized human. Harness Runtime v2 separates rules, hooks, skills, and agent roles and reports unsupported host features instead of claiming parity.

### 6. Agent Surface Security and brokered execution

The security engine scans instructions, skills, hooks, MCP descriptions, command permissions, lifecycle scripts, secret references, memory, and generated host configuration. It constructs role→tool→resource→secret→egress paths. The local execution broker uses argv without a shell, command/env allowlists, realpath containment, process-group timeouts, bounded output, and content-addressed receipts. It is not a universal microVM sandbox.

### 7. Trust Kernel and persistence

The Trust Kernel continues to enforce revision/CAS, leased writes, artifact content/envelope hashes, approval binding, trusted evidence, assurance-aware state transitions, ACLs, snapshots, restore, and append-only evaluations. SQLite WAL is the integrated single-node backend. PostgreSQL transaction/outbox primitives exist, but full lifecycle and tested multi-node failover are not v0.6 claims.

### 8. Public surfaces

Stdio MCP, HTTP MCP, A2A 1.0, CLI, and Forge Studio share the same services and JSON Schemas. v0.6 adds six strict tools for status, execution graph compilation, review scope, work-unit context, harness profile planning, and agent-surface scanning. The complete server currently advertises 50 MCP tools.

See [Quick Start](QUICKSTART.md), [Deterministic Skill Fabric](DETERMINISTIC-SKILL-FABRIC-V06.md), [Harness Runtime](HARNESS-RUNTIME-V2.md), [Security](AGENT-SURFACE-SECURITY.md), and [Claims Boundary](CLAIMS-BOUNDARY-V0.6.md).
