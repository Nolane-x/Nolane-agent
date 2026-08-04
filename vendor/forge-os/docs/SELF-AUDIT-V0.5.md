# ForgeOS v0.5 Self-Audit — Skill Intelligence Foundation

This document records the adversarial self-review performed before the v0.5 release. A feature is counted only when its runtime boundary, public contract, and regression evidence agree.

## Verified in this release

- Skill Contract v2 validates triggers, anti-triggers, typed artifacts, evaluator bindings, section budgets, maturity, and inherited policy profiles.
- Thirty-three migrated stable procedural providers materialize successfully with the same token-accounting registry used by the resolver.
- Thirty-two L0 kernel packages exist as distinct hybrid techniques. Three remain stable from previously exercised behavior; twenty-nine are candidate and are not represented as production-proven.
- Capability Graph v2 separates outcome, technique, provider, and evaluator. It supports many-to-many mappings and preserves mapping evidence.
- The Skill Intelligence Router retrieves outcomes and techniques, applies anti-triggers and hard trust/tool filters, composes a minimal DAG, records exclusions, and produces a deterministic hashed RoutePlan.
- Global Context Kernel enforces a request-wide budget across system, task, skill, code, artifact, memory, tool-output, and reference categories. Every omitted item is recorded with source hash and retrieval information.
- Section materialization verifies package boundaries, real paths, section digests, provider digests, and hard token limits. Scripts are not executed during materialization.
- Deterministic Skill Fabric makes scope, work-unit coverage, rule resolution, output anchoring, and reflection explicit. A model cannot claim completion while the deterministic coverage ledger remains incomplete.
- Eval Lab v2 ignores producer self-reported quality, gives deterministic failures veto power, requires independent semantic judges, hashes holdout manifests, and uses confidence-aware maturity decisions.
- MCP, CLI, and Forge Studio use the same Skill Intelligence service and generated output schemas.

## Measured release evidence

The public router corpus currently reports Precision@1 93.75%, Precision@3 100%, Recall@6 100%, unsafe activation 0%, and deterministic RoutePlan hashes for identical semantic input. These figures apply only to the published corpus and pinned release implementation. They do not prove general routing performance over every domain or language.

The context benchmark verifies 33/33 stable providers materialize, tool-output distillation exceeds the published threshold on the benchmark fixture, and Semantic ABI orientation reduces the supplied repository-orientation fixture by more than 90%. These are bounded benchmark claims, not universal token-reduction guarantees.

## Defects discovered during v0.5 self-review

- The initial anti-trigger matcher treated a query about preventing repeated automation side effects as a read-only task. The matcher now requires stronger phrase coverage and the case is a regression test.
- The first unified composer allowed a generic orchestration technique to replace domain techniques for a multi-outcome request. Direct outcome techniques are now selected first; orchestration techniques may coordinate but not satisfy specialist outputs by themselves.
- The v0.4 provider mapping algorithm forced one skill into one unused capability and produced semantically incorrect assignments. Stable v2 mappings are explicit many-to-many reviewed records.
- Resolver and materializer previously measured different payload boundaries. They now share one token-accounting registry and section index.
- Compatibility tests exposed public DTO and count drift after adding L0 packages. Generated schemas and versioned compatibility fields now define the boundary.

## Explicitly open

- The 1,024 v0.4 capability records are outcome scaffolds, not 1,024 deep procedural techniques.
- Capability Graph v2 contains 62 deep techniques and 62 evaluator bindings at this release.
- Twenty-nine new L0 techniques remain candidate. The release does not claim hidden-holdout or multi-model certification for them.
- The public routing corpus is intentionally small and must expand before broad comparative claims.
- Token providers use deterministic estimators and shared accounting, but the target p95 error of 8% against provider-reported usage has not yet been proven across the complete model matrix.
- Semantic ABI has stable IDs and stale-hash rejection for TypeScript/JavaScript, Python, Rust, and Go fixtures; production-grade call, import, test, and build graph extraction remains incomplete.
- The deterministic fabric supplies reusable primitives, not a bespoke hard pipeline for every domain technique.
- PostgreSQL full-lifecycle parity, multi-node failover, universal third-party-code sandboxing, A2A streaming/push, managed PKI/transparency service, SCIM, and organization administration remain outside v0.5.
- The release does not contain 10,000 paired evaluation runs or 1,024 Skill-TDD-complete procedural packages.
- Studio v3 is a route/context inspection foundation, not a complete visual capability-graph editor.

## Claims gate

ForgeOS v0.5 may be described as a tested Skill Intelligence foundation. It must not be described as universally production-complete, defect-free, containing 1,024 production-grade procedural skills, or superior to another project without a pinned and reproducible comparative benchmark.
