# ForgeOS v0.6 Self-Audit

## Findings discovered during implementation

The v0.6 upgrade found and fixed:

1. release coverage and archive runners that could retain nested-process handles;
2. pagination tests that assumed the entire MCP tool catalog fit in one page;
3. hardcoded v0.5 technique and evaluator counts;
4. capability compilation that treated the old stable-mapping table as the only source of truth;
5. a direct-trigger retrieval case where a generic orchestration technique displaced an outcome-specific technique;
6. anti-trigger matching that confused negated phrases with the forbidden condition;
7. missing public context for newly advertised v0.6 MCP tools;
8. local process execution without an explicit brokered command/path/environment boundary.
9. Windows A2A and evaluation persistence failures caused by an unsupported directory `fsync` path after atomic rename.
10. stable skill materialization failures caused by CRLF checkout conversion changing section digests.
11. a signed remote sandbox receipt that could omit an isolation field and still inherit it from the provider profile.

Each item has a regression test.

## Residual risks

- 95 of the 128 current kernel techniques are candidate, not stable.
- Token accounting implementations still require broader calibration against provider-reported usage.
- Semantic ABI currently protects symbol identity and hashes but is not a complete language-semantic call graph.
- Code Review Intelligence uses a deterministic 12-case corpus, not a large expert-labeled benchmark.
- The brokered local runner is not a universal container or microVM sandbox.
- The remote sandbox adapter has no configured live Linux/KVM provider or independently collected guest-isolation evidence in this repository.
- The imported skill examples are candidate-only and have not completed evaluation or human promotion.
- On Windows, two descendant-process mutation scenarios are explicitly skipped because this runner has no equivalent process-tree proof; they are not counted as killed mutations.
- PostgreSQL components do not yet provide the complete lifecycle contract used by SQLite.
- Cross-harness behavior is protocol-tested where possible, not vendor-certified.

## Release rule

The release audit fails when skill depth, boilerplate, stable materialization, security corpus, or contract validation regresses. Claims remain constrained by [CLAIMS-BOUNDARY-V0.6.md](CLAIMS-BOUNDARY-V0.6.md).


## Formal skill certification status

The catalog currently declares 33 providers in the stable routing channel. The final package-bound certification audit finds **0 evidence-qualified stable** and **0 certified** techniques under the Revision 2 criteria because hidden holdout receipts, paired multi-model runs, independent certification reviews, production evidence, expiry attestations, and the L0 50-scenario threshold are not complete. See `docs/FINAL-CERTIFICATION-AUDIT.md`.
