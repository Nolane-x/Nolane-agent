# ForgeOS v0.4 Self-Audit and Claims Boundary

This document records the adversarial self-review performed before the v0.4.0 release. It is intentionally stricter than the project README: a feature is counted as implemented only when its public boundary, runtime invariant, and regression evidence agree.

## What was challenged

The review concentrated on failure modes that passed earlier test suites:

- tenant data leaking through federation list, audit, bundle resolution, or Studio routes;
- global first-party providers being modified through tenant administration APIs;
- provider imports escaping their declared directory through symlinks or nested-skill contamination;
- MCP executions sharing mutable receipt state across concurrent calls;
- pre-aborted requests continuing until timeout;
- permissive public schemas allowing internal/public contract drift;
- generated catalogs changing canonical source content during release verification;
- package manifests omitting assets, deployment files, or runtime schemas;
- knowledge mappings being counted as procedural expertise;
- external popularity being treated as trust.

Each reproduced failure received a regression test before the implementation was changed.

## Verified v0.4 invariants

### Federation isolation

- External providers are scoped to a tenant unless explicitly built into the signed release.
- Public provider listing, audit, bundle resolution, synchronization, scanning, evaluation, and promotion enforce the authenticated tenant and principal.
- Built-in providers cannot be modified through tenant APIs.
- A provider with the same provider ID may exist independently in two tenants without collision.

### Safe acquisition and materialization

- GitHub skill synchronization requires an immutable forty-character commit.
- Imported files are size- and count-bounded, normalized, and placed in quarantine.
- Root and nested skills are split into independent provider subtrees.
- `realpath` verification prevents local symlink escape.
- Materialization verifies bundle and provider digests, loads only stable text providers, excludes executable files, and enforces a context budget.
- Knowledge providers materialize references and metadata rather than silently copying remote content.

### Brokered MCP execution

- Only stable, currently scanned MCP providers may execute.
- Tools must be explicitly allowlisted.
- Write-capable tools require an authenticated human operator.
- Credentials remain behind reference resolvers and are not returned to the model context.
- Timeout, output-size bounds, cancellation, and session cleanup are enforced.
- Execution receipts are local to one call and contain hashes and provenance, not sensitive tool output by default.

### Capability and provider accounting

The release audit derives its numbers from generated data rather than README constants:

- 1,024 typed capability contracts;
- 242 first-party procedural providers;
- 33 stable procedural providers;
- 209 candidate procedural providers;
- 1,024 knowledge-provider mappings;
- 782 capabilities without a built-in procedural provider;
- 991 capabilities without a stable procedural provider;
- zero externally imported providers in a clean installation.

Knowledge coverage never satisfies procedural coverage in the audit.

### Public contract and release integrity

- Federation DTOs share canonical runtime JSON Schemas.
- MCP tool responses are validated against those schemas through a full MCP lifecycle.
- Catalog and schema generators are deterministic.
- Release verification fails when generation changes canonical source content (text line endings are normalized; binary bytes remain exact).
- Archives are verified after extraction without `.git`.
- Package-surface tests cover runtime code, schemas, deployment manifests, assets, documentation, and federation data.

## Residual production boundaries

ForgeOS v0.4.0 must not be described as universally or perfectly production-ready.

### Storage and high availability

SQLite WAL is the integrated production backend for one active application node. The PostgreSQL transaction/outbox adapter is not yet a drop-in implementation of the complete project, artifact, evidence, federation, evaluation, A2A, snapshot, and recovery lifecycle. Multi-node high availability therefore remains open.

Direct writers that bypass the selected repository interface are outside the consistency boundary.

### Third-party execution isolation

External skills are synchronized, scanned, evaluated, and materialized as bounded text. ForgeOS does not automatically execute imported scripts. It also does not yet include a general-purpose VM, microVM, container sandbox, seccomp profile generator, or network-isolation runtime for arbitrary third-party code.

### Identity administration

OIDC verification, API-key service accounts, project ACLs, tenant-scoped federation, and fail-closed policy decisions are implemented. Organization lifecycle, SCIM provisioning, delegated tenant administration, managed signing-key rotation, hardware-backed keys, and a transparency log are not complete.

### Expert coverage

A typed capability contract is not proof of procedural expertise. Only 33 first-party procedural providers are stable in this release. The remaining candidate skills and uncovered capabilities require independent implementation, evaluation, and maintenance by qualified contributors.

### Knowledge freshness and licensing

Linked standards, vendor references, repositories, and community indexes can become stale or change licensing. Pinned revisions, recurring scans, license review, and evaluation expiry are required. ForgeOS does not convert stars, publisher identity, or inclusion in an awesome list into trust.

### Semantic quality

The built-in similarity and duplicate checks are deterministic and auditable. They are not universal semantic understanding. Stronger embedding or judge providers can be federated, but their outputs must remain evidence-bound and independently evaluated.

### Protocol and interface scope

A2A streaming and push notifications remain open. Forge Studio is an operational dashboard and federation surface, not yet a complete visual capability-graph editor. Adapter TCK results demonstrate ForgeOS protocol compatibility only; they are not vendor certification.

### Operational assurance

The supplied Compose and Kubernetes manifests target one SQLite-backed replica behind a trusted TLS edge. They are reference deployments, not a managed service. Operators remain responsible for secret custody, backup testing, storage durability, monitoring retention, disaster recovery, and jurisdiction-specific compliance.

## Release decision rule

A v0.4 release is acceptable only when all of the following are true:

1. the full automated suite and all validators pass from a clean source commit;
2. federation adversarial cases pass;
3. the derived federation audit reports no hidden count or trust blocker;
4. source generation is deterministic;
5. ZIP and TAR archives pass installation, test, protocol, federation, and archive-first verification outside Git;
6. SBOM, per-file manifest, archive digests, provenance, and detached signature verify;
7. this claims boundary remains accurate for the released bytes.

A failing condition blocks release rather than being converted into a high aggregate score.
