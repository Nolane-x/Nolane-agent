# Deterministic Skill Fabric v0.6

ForgeOS v0.6 compiles a Skill Contract v2 technique into an execution graph. The graph separates mechanical guarantees from model judgment.

## Node classes

| Node | Responsibility |
|---|---|
| `deterministic` | Scope, rules, anchoring, evidence, and invariants |
| `agent` | Investigation, hypothesis generation, and domain judgment |
| `reflection` | Contradiction, false-positive, and actionability checks |
| `join` | Wait for all required parallel work units |
| `gate` | Fail closed when coverage or evidence is incomplete |
| `rollback` | Record the defined recovery path |

Graph compilation rejects duplicate nodes, dangling edges, cycles, and missing work units. The graph hash binds the technique version, work units, nodes, edges, retry policy, and failure policy.

## Coverage Ledger

`SqliteCoverageLedgerStore` records each work unit with:

- owner and lease token;
- fencing sequence;
- expiry and heartbeat;
- status and receipt hash;
- current revision.

When a lease expires, a new worker may reclaim it with a higher fencing sequence. The previous worker cannot commit completion. The terminal coverage gate fails until every required unit has a trusted receipt.

## Code Review Intelligence vertical slice

The v0.6 code-review pack implements:

1. deterministic changed-file accounting;
2. relation-aware work-unit bundles;
3. contextual rule resolution;
4. isolated agent analysis;
5. file/hash/line anchoring;
6. anchor relocation after edits;
7. independent reflection;
8. coverage proof.

The included 12-case corpus is a conformance benchmark. It is not an expert-adjudicated production benchmark.

## Brokered execution

The local broker runs allowlisted argv without a shell, contains working directories by lexical and real path, filters environment variables, limits output, applies a deadline, terminates the process group, and issues a receipt.

It does not implement universal syscall or network isolation. High-risk imported code requires an external container or microVM execution provider.
