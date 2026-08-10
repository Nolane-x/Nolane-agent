# Changelog

All notable changes are documented here.

## [0.6.1] - 2026-07-26

### Fixed
- Enforced authenticated principals and correct write authorization across MCP and A2A mutations.
- Preserved principal provenance in intent, idea, route, gate, stage, and next-action audit events.
- Reaped descendant processes in release and trusted-evidence runners on success, timeout, and abort.
- Added Streamable HTTP SSE response support and linked timeout cancellation to remote MCP execution.
- Removed stale MCP client-version metadata and derived v0.6 status/audit versions from the product constant.

### Verification
- Added critical mutation testing and a machine-readable skill-certification claims gate.
- Clarified that catalog maturity labels are not formal stable/certified evidence under the Skill Intelligence Definition of Done.

## 0.6.0 — 2026-07-25

### Deterministic execution and context

- Added typed Execution Graph nodes for deterministic, agent, reflection, join, gate, retry, rollback, and cancellation stages.
- Added a durable fenced Coverage Ledger with lease, heartbeat, reclaim, receipt, and fail-closed completion semantics.
- Added Global Context Kernel v2 with isolated work-unit contexts, lazy tool schemas, cache plans, scoped instincts, Semantic ABI checks, and omission receipts.
- Added a brokered local process runner with no-shell argv execution, allowlists, realpath containment, deadlines, bounded output, and receipts.

### Skill, review, learning, harness, and security

- Expanded the deep kernel from 62 to **128 kernel techniques**: 32 L0 and 96 L1, each with evaluator bindings and evidence-based maturity.
- Added the Code Review Intelligence vertical slice: deterministic scope, relation-aware bundles, contextual rules, anchors, relocation, independent reflection, and a 12-case conformance benchmark.
- Added quarantined Continuous Learning with scoped expiring instincts, deterministic clustering, candidate-only evolution, independent promotion, and rollback.
- Added Harness Runtime v2 with neutral events, rules/hooks/skills/agent-role separation, selective profiles, memory namespaces, and truthful capability matrices.
- Added Agent Surface Security with permission-graph analysis and a 20/20 adversarial corpus.

### Public surfaces and documentation

- Added six strict v0.6 MCP tools, shared CLI/HTTP/stdio services, public JSON Schemas, Studio v3 foundation, and a v0.6 machine-readable release audit.
- Rebuilt README and README-vn for a five-minute user path and a deep operator path; refreshed **22 localized README files** with v0.6 inventory and trust boundaries.
- Kept explicit non-claims for 1,024 production-grade skills, full PostgreSQL HA, universal microVM sandboxing, 10,000 paired runs, and an expert-labeled 200-PR benchmark.

## 0.5.0 — 2026-07-25

### Skill Intelligence foundation

- Added Skill Contract v2, policy inheritance, section-level materialization, a unified router, Capability Graph v2, Global Context Kernel, Deterministic Skill Fabric, Eval Lab v2, 32 L0 kernel packages, public MCP tools, and the `forge` CLI.
- Reclassified the 1,024 v0.4 nodes as legacy outcome scaffolds and published 62 deep techniques with 62 evaluator bindings.
- Fixed the stable materialization mismatch: 33/33 stable procedural providers now use one token accounting boundary.
- Added public router, context, and Skill Intelligence audits with explicit claims boundaries.

### Honest maturity boundary

- Kept 29 new L0 techniques at candidate maturity.
- Did not claim 1,024 production-grade procedural skills, 10,000 paired runs, universal token reduction, full PostgreSQL lifecycle HA, or a universal sandbox.

## 0.4.0 — 2026-07-25

### Federated capability system

- Added 1,024 typed capability contracts across 32 disciplines and lifecycle operations, with domain-specific I/O, evidence, tools, knowledge, risk, and dependency metadata.
- Added 1,266 built-in provider mappings: 242 first-party procedural skills and 1,024 reference-only knowledge mappings across 32 knowledge packs.
- Added immutable source registry, GitHub synchronization, tenant-scoped providers, license policy, quarantine, security scanning, trusted evaluation receipts, promotion, expiry, semantic deduplication, and honest coverage audit.
- Added execution bundles and bounded materialization that freeze provider/capability hashes without loading whole repositories or executing scripts.

### MCP and production boundaries

- Added MCP discovery/assessment/broker execution with tool allowlists, human approval for writes, secret references, timeout/output bounds, and hash/provenance receipts.
- Added SQLite WAL transactional stores for projects, federation providers, EvalRun receipts, and A2A tasks; kept JSON as portable development/archive storage.
- Added OIDC verification, fail-closed PDP integration, tenant federation policy, graceful draining, bounded metrics, mounted secret files, and production Compose/Kubernetes single-node manifests.
- Documented PostgreSQL transaction/outbox support as an adapter rather than a complete drop-in lifecycle backend.

### Verification and claims boundary

- Added 18-case federation adversarial corpus, Federation Audit, strict public schemas, deployment tests, tenant-isolation tests, and archive release requirements.
- Published procedural/stable coverage separately: 782 capabilities lack a built-in procedural provider and 991 lack a stable procedural provider.
- Rewrote README, production, federation, MCP, security, architecture, and threat-model documentation around capabilities and providers rather than inflated skill counts.

## 0.3.0 — 2026-07-25

### Trust Kernel and storage

- Replaced stale file locks with token-owned leases, heartbeats, fencing checks, owner-safe release, revision/CAS, verified snapshots, public restore, and a hash-chained aggregate audit.
- Added deterministic schema-v5 migration from real v0.1/v0.2 fixtures; legacy evidence is preserved as unverified with migration provenance.
- Added project ownership and ACL capabilities across MCP, A2A, HTTP Studio, export, recovery, review, and release paths.

### Trusted proof and assurance

- Removed caller-supplied PASS evidence. Allowlisted providers now execute methods, store content-addressed payloads, and issue server-generated receipts.
- Added artifact content/envelope hashes, slots, exact dependency hashes, assurance-aware lifecycle reduction, and two-way supersession lineage.
- Made A0–A4 change artifact states, allowed proof methods/issuers, separation of duty, finding blockers, and release obligations.

### Agent execution and evaluation

- Added leased A2A scheduling with heartbeat, retry budgets, cancellation, stale-worker fencing, persisted history, and `historyLength=0` conformance.
- Added frozen skill-run contracts, context hashes, trusted completion inspection, output handoffs, and removal of worker-supplied utility.
- Added immutable EvalRun records, paired confidence, trusted promotion/quarantine, and utility derived only from accepted evaluation runs.

### Protocol, Studio, and release

- Fixed MCP public DTO drift, added owner-bound session deletion, invalid-initialize cleanup, bounded session/rate stores, fail-closed network construction, and full public-tool conformance.
- Added standalone same-origin MCP mode for Forge Studio, ACL-safe project listing, and snapshot recovery controls.
- Rebuilt release verification around actual source manifests, immutable output directories, clean-archive acceptance, CycloneDX SBOM, in-toto/SLSA-style provenance, and detached Ed25519 signing support.
- Added the 197-finding v0.2 deep-audit remediation matrix with conservative fixed/mitigated/open classification.

## 0.2.0 — 2026-07-24

### State integrity

- Added monotonic project revisions, semantic revisions, compare-and-swap updates, fixed writer-tail serialization, cross-process file locks, durable atomic writes, schema migration, bounded snapshots and corrupt-project quarantine.
- Sealed released projects against later mutation.
- Added runtime aggregate validation for IDs, foreign references, artifact hashes, dependency DAGs and exact idea score coverage.

### Proof and approvals

- Bound evidence and gate results to current project/artifact subjects, revisions, hashes and canonical input digests.
- Made semantic mutations stale earlier gates automatically.
- Added assurance-specific runtime gate requirements and finding blockers.
- Replaced textual human confirmation with one-time, expiring, revision-bound approval capabilities tied to authenticated principals.

### Artifact and idea lifecycle

- Added canonical nested JSON hashing, type registries, active-version uniqueness, independent review, public verify/supersede/invalidate APIs and automatic downstream invalidation.
- Added mechanism fingerprints, deterministic similarity clustering, fresh score provenance and approved idea selection.

### Skill graph and evaluation

- Rebuilt all 242 contracts around a shared typed artifact vocabulary and verified a route from confirmed intent to release dossier.
- Added metadata-only catalog caching, lazy skill-body loading, prerequisite planning, risk/gate/tool/utility-aware routing and a persisted skill-run lifecycle.
- Added deterministic behavioral case/seed execution, forbidden-pattern and evidence checks, confidence intervals, promotion/quarantine provenance and utility feedback.

### Protocols and Studio

- Implemented MCP `2025-11-25` lifecycle, version/session/origin/schema enforcement, stdio bridge and 25 public tools.
- Replaced the A2A demo subset with A2A 1.0 Agent Card, message execution, persistent task ownership/history, listing and cancellation.
- Rebuilt Forge Studio around truth-derived gate status, proof subjects, artifact dependencies/hashes/states, risks/findings, project selection and skill-run controls.

### Verification and compatibility

- Added a public-tool-only fourteen-stage lifecycle test ending in a sealed release.
- Replaced manifest-presence checks with an executable adapter TCK for nine configurations; marked six additional integrations documentation-only.
- Rebuilt release verification to derive command evidence, source commit/tree, output digests, test counts, coverage, adapter evidence, dashboard hash and residual risks.
- Added a per-file evidence-status manifest and the 190-finding audit remediation matrix.

## 0.1.0 — 2026-07-24

### Added

- Initial provider-neutral ForgeOS prototype, typed project/artifact primitives, skill catalog, MCP/A2A demonstrations, Forge Studio, behavioral fixtures, adapters, documentation, and MIT License.
