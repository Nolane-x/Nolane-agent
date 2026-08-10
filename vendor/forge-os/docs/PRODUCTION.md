# ForgeOS v0.6 Production Deployment

ForgeOS v0.6 provides a production-oriented **single-node** control plane using Node.js 22+, SQLite WAL, mounted secrets, OIDC or API-key authentication, tenant/project ACLs, fail-closed policy decisions, bounded metrics, graceful drain, and persistent volumes.

The deployment serves the v0.6 Skill Intelligence Router, 128-technique Deterministic Skill Fabric, Trust Kernel, federation, MCP/A2A, CLI, and Studio surfaces.

## Supported profile

The integrated deployment uses one ForgeOS replica with SQLite WAL. Project state, federation providers, evaluation receipts, A2A tasks, leases, snapshots, recovery, and audit contracts are tested on this backend. The container runs non-root with a read-only root filesystem and a writable data volume. Health and readiness reflect storage and federation state.

## Execution boundary

The built-in local broker is suitable for normal allowlisted commands. It uses no shell, restricts command/environment/cwd, prevents symlink escape, kills process groups at deadline, bounds output, and emits receipts. High-risk imported code must use an external microVM provider with network deny-by-default and separate secret scopes; it must not use the local broker.

ForgeOS can enforce that route through its fail-closed remote control-plane adapter. Configure `FORGEOS_SANDBOX_ENDPOINT` and `FORGEOS_SANDBOX_PUBLIC_KEY`, then require `node src/cli/forge.mjs sandbox status --json` to exit `0` before enabling high-risk execution. The provider must publish the compatible profile and return request-bound Ed25519-signed receipts. If it is missing, unreachable, or unsafe, no local fallback occurs. Deploy the provider on an independently administered Linux/KVM or equivalent microVM-capable domain and test its network and secret-denial controls. See [Remote MicroVM Sandbox](REMOTE-MICROVM-SANDBOX.md). No live provider is included in this repository.

## Team and enterprise prerequisites

OIDC, external PDP, tenant-scoped federation, project ACLs, mounted secret files, and non-root deployment are integrated. Full organization provisioning, SCIM, managed PKI/transparency, and delegated administration are open boundaries.

## PostgreSQL boundary

ForgeOS includes serializable PostgreSQL transaction/outbox primitives, but not a full drop-in lifecycle implementation for every store. Multi-replica HA, failover, distributed sessions, and disaster-recovery claims are blocked until the PostgreSQL backend passes the same lifecycle, migration, concurrency, protocol, backup, and archive suites as SQLite.

## Operations

Use graceful SIGTERM, readiness before traffic, per-tenant rate limits, external TLS, immutable release assets, SBOM/provenance verification, regular snapshot verification, restore drills, and separate storage for release/transparency checkpoints. See [Security Model](SECURITY-MODEL.md) and [Claims Boundary](CLAIMS-BOUNDARY-V0.6.md).
