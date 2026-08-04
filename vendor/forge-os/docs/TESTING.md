# ForgeOS v0.6 Verification Strategy

ForgeOS uses coverage as one signal, never as proof of correctness. Release gates are built around invariants, protocol conformance, adversarial scenarios, archive behavior, and current evidence.

## Mandatory layers

1. Unit and property tests for state reducers, hashing, schema, leases, and token accounting.
2. Concurrency tests for CAS, fencing, stale workers, SQLite transactions, A2A tasks, and coverage ledgers.
3. Full MCP lifecycle and output-contract tests for every public tool family.
4. A2A 1.0 ownership, history, cancellation, retry, and persistence tests.
5. Skill Contract v2 depth, boilerplate, section hash, mapping, and stable-materialization tests.
6. Router precision/recall/determinism/unsafe-route benchmark.
7. Global context budget, omission, Semantic ABI, and tool-distillation benchmark.
8. Execution Graph, Code Review Intelligence, Continuous Learning, Harness Runtime, and Agent Surface Security tests.
9. Federation security/adversarial corpus and promotion/quarantine tests.
10. Adapter TCK, Studio rendering, package surface, and clean archive acceptance.

## Current release evidence

The current suite contains 369 automated tests before final release regeneration. The v0.6 audit reports 128 kernel techniques, 12 code-review conformance cases, and 20/20 agent-surface adversarial cases. Stable materialization is 33/33. Final counts and coverage must be derived again by `npm run release:verify`; this document must not be used as a substitute for fresh evidence.

## Claims discipline

The 12 review cases are a deterministic conformance corpus, not an expert-labeled 200-PR benchmark. Router and context metrics apply only to pinned public corpora. v0.6 does not claim 10,000 paired evaluations, universal tokenizer error below 8%, or full PostgreSQL multi-node failover.

Run `npm run validate`, `npm run v06:audit`, `npm run router:benchmark`, `npm run context:benchmark`, `npm run federation:eval`, `npm run smoke`, `npm run adapter:tck`, and `npm run release:verify`.
