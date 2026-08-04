# Forge Studio 2.5.0 Local Resource Sandbox Design

## Goal

Add a local-only resource sandbox that can place managed terminal processes under explicit CPU, RAM, process-count, and workspace-disk limits, expose durable evidence, and provide an authenticated Sandbox Manager UI. The release closes checklist items 4.31, 18.12, 18.13, 18.14, and 18.15 only when source, direct tests, API/UI wiring, and a release gate all pass.

## Scope and non-claims

The implementation supports JavaScript-managed local terminal sessions on the current host. On Linux it uses cgroup v2 when a writable delegated cgroup root is available. Otherwise it uses a watchdog that measures the process tree and terminates it after a configurable number of consecutive limit violations. Disk quota is enforced by workspace scanning in every mode. Windows Job Objects, macOS sandbox profiles, Podman, Docker isolation parity, filesystem namespaces, and network namespaces remain explicitly unimplemented or externally gated.

## Architecture

`LocalResourceSandboxService` owns lease validation, durable SQLite state, sampling, violation classification, termination, receipts, and lifecycle. `LinuxProcResourceDriver` reads bounded `/proc` process-tree metrics and terminates the tree. `CgroupV2ResourceDriver` creates a lease cgroup, writes `cpu.max`, `memory.max`, and `pids.max`, attaches the terminal PID, reads cgroup usage, and removes the group. `WorkspaceDiskMeter` walks only the lease workspace with entry and byte bounds.

`TerminalManager` accepts an optional `sandbox` request. It creates a lease before the PTY session, requires the PTY host to return a PID, attaches that PID, and closes the lease on terminal exit or termination. If attachment fails, the terminal is terminated and the lease is closed. Unsandboxed terminal behavior remains backward compatible.

## Data model

A lease records: id, projectId, workspaceRoot, principalId, state, enforcement mode, limits, attached root PID, latest usage, consecutive violations, created/updated/closed timestamps, violation reason, and receipt SHA-256. SQLite is stored under the Forge Studio data directory. API responses never expose arbitrary environment variables or command-line contents.

Limits are bounded as follows:

- CPU: 1–1000 percent, where 100 means one logical CPU.
- RAM: 16 MiB–64 GiB.
- Process count: 1–4096.
- Disk: 1 MiB–1 TiB.
- Sample interval: 250–60,000 ms.
- Violation grace: 1–20 consecutive samples.

## Enforcement flow

1. Resolve the project and ensure the workspace root matches the project.
2. Create a durable lease and select `cgroup-v2` or `watchdog-terminate` mode.
3. Start the terminal and require a positive PID.
4. Apply cgroup limits when available and attach the PID; otherwise begin watchdog sampling.
5. Sample CPU, RSS, process count, and workspace bytes.
6. Store usage and a content-addressed receipt.
7. When any limit is exceeded for the configured grace count, terminate the process tree, mark the lease `violated`, and store the exact violated dimensions.
8. Closing a lease stops timers, terminates an attached live tree when requested, cleans the cgroup, and records a final receipt.

## API and UI

Authenticated endpoints:

- `GET /api/local-resource-sandboxes/capabilities`
- `GET /api/local-resource-sandboxes?projectId=...`
- `GET /api/local-resource-sandboxes/:id`
- `POST /api/local-resource-sandboxes/:id/sample`
- `POST /api/local-resource-sandboxes/:id/close`

Lease creation and PID attachment are internal to `TerminalManager`; the HTTP API cannot attach arbitrary host PIDs.

The lazy-loaded Sandbox Manager displays capability mode, active/violated/closed leases, CPU/RAM/process/disk meters, violation evidence, receipt hashes, refresh, sample-now, and close controls. It does not persist the auth token in browser storage.

## Error handling and security

All IDs, limits, roots, and PIDs are validated. Project scoping and principal binding are enforced on every API call. `/proc` traversal is bounded and ignores processes that disappear mid-sample. Workspace traversal rejects symlink escapes and caps entries. Cgroup setup failures fall back only when no partial cgroup attachment occurred; attachment failures fail closed. Receipt payloads are canonicalized and redacted to structural fields.

## Testing and release proof

Tests cover validation, cgroup file writes, process-tree accounting, disk measurement, consecutive-violation behavior, termination, terminal attachment rollback, authenticated API principal binding, UI surfaces, app wiring, audit transitions, and a fail-closed verifier. Full Release Matrix gains a required `local-resource-sandbox` gate. Podman, Windows Job Objects, and macOS sandbox entries must remain `not_implemented`.
