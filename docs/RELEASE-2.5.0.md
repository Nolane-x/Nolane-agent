# Forge Studio 2.5.0 release notes

## Local Resource Sandbox

Forge Studio now creates durable, project-scoped and principal-scoped resource leases for terminal processes launched through Forge. Each lease carries bounded limits for CPU percentage, resident memory, process count, workspace disk usage, sampling interval, and consecutive-violation grace.

On Linux, Forge Studio uses cgroup v2 when the `cpu`, `memory`, and `pids` controllers are present and writable. It writes `cpu.max`, `memory.max`, and `pids.max`, attaches the PTY PID through `cgroup.procs`, reads usage from cgroup files, and removes the lease group when execution ends.

When writable cgroup v2 is unavailable, Forge Studio uses a watchdog termination mode. Linux samples the full descendant tree from `/proc`; Windows uses PowerShell/CIM process records and terminates with `taskkill /T /F`; other POSIX hosts use `ps`. Workspace disk accounting is bounded and does not follow symbolic links.

## Fail-closed terminal lifecycle

TerminalManager creates the resource lease before creating the PTY. A sandboxed terminal must return a positive PID and that PID must attach successfully before the session is exposed. Any failure terminates the PTY and closes the lease. PTY exit and explicit terminal termination also close the associated lease.

The watchdog records CPU, memory, process, and disk samples. A single overage enters pressure state; termination occurs only after the configured number of consecutive violating samples. Every durable transition receives a content-addressed receipt.

## Governed surfaces

Authenticated APIs expose capabilities, principal-bound lease listing and status, explicit sampling, and closure. No HTTP endpoint permits arbitrary PID attachment.

The lazy-loaded Sandbox Manager displays host capability mode, resource meters, limits, current violations, process identity, state, and receipt evidence. It offers explicit sample and close controls.

## Release governance

The required `local-resource-sandbox` gate verifies platform drivers, cgroup files, bounded disk measurement, durable scoping, violation termination, terminal rollback, authenticated API behavior, user-interface evidence, audit mapping, explicit non-claims, and Full Release Matrix inclusion.

## Audit movement

Exactly five checklist items moved from `not_implemented` to `verified_source_test`:

- 4.31 — Trình quản lý sandbox
- 18.12 — Hỗ trợ giới hạn CPU
- 18.13 — Hỗ trợ giới hạn RAM
- 18.14 — Hỗ trợ giới hạn process
- 18.15 — Hỗ trợ giới hạn disk

The audit total is 637 verified, 91 partial, 52 external-gated, and 10 not implemented out of 790. Podman, Windows Job Objects, and macOS sandbox support remain explicitly not implemented.
