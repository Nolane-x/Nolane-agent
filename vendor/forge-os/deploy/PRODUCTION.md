# ForgeOS production deployment boundary

## Supported deployment in v0.4

The integrated production path is a **single-node** ForgeOS control plane using SQLite WAL on a durable local or block volume. Run exactly one replica. The HTTP boundary supports API-key service authentication, OIDC verification when configured by an embedding host, tenant-scoped project/provider authorization, health probes, bounded sessions, rate limiting, graceful draining, and non-root containers.

Place ForgeOS behind a trusted TLS reverse proxy. Keep `/metrics` and administrative routes on a private network. Back up the SQLite database using volume snapshots or SQLite's online backup facilities and test restoration regularly.

## PostgreSQL boundary

The repository includes a PostgreSQL serializable transaction, fencing, idempotency, and same-transaction outbox adapter plus SQL migrations. It is **not a drop-in replacement for the full ProjectStore lifecycle in v0.4**. Do not scale the ForgeOS application above one replica merely by pointing at PostgreSQL. Horizontal multi-node lifecycle support remains an explicit open production item until project, federation, evaluation, task, snapshot, and recovery stores all run through the distributed backend and pass the same acceptance suite.

## Required operator actions

1. Generate the API key outside the repository and mount it as a secret file.
2. Set an HTTPS `FORGEOS_PUBLIC_BASE_URL` and exact allowed origins.
3. Restrict egress. External skill sources and MCP servers are untrusted until pinned, scanned, evaluated, approved, and promoted.
4. Keep external providers tenant-scoped.
5. Run `npm run release:verify` against the exact archive before deployment.
6. Monitor readiness, request failures, lease conflicts, federation blockers, and storage size.
