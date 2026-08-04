# Forge Studio 2.5.0 verification contract

A 2.5.0 release is valid only when the complete Full Release Matrix runs from gate 1 on a clean committed tree and every required gate passes.

## Local resource sandbox gate

`local-resource-sandbox` must prove:

- Linux `/proc`, Windows CIM, and POSIX `ps` process-tree measurement;
- child-tree termination behavior on each supported watchdog surface;
- writable Linux cgroup v2 detection;
- `cpu.max`, `memory.max`, and `pids.max` policy application;
- PID attachment through `cgroup.procs` and cgroup cleanup;
- bounded workspace disk measurement without symbolic-link traversal;
- durable project and principal scoping in SQLite;
- bounded CPU, RAM, process, disk, interval, and violation-grace policy;
- consecutive-violation pressure and termination behavior;
- content-addressed lease and event receipts;
- fail-closed PTY creation, positive-PID requirement, attachment, rollback, and cleanup;
- authenticated principal-bound capability, list, status, sample, and close APIs;
- absence of an arbitrary HTTP PID-attachment endpoint;
- application and terminal WebSocket wiring;
- observable Sandbox Manager resource meters, evidence, sample, and close controls;
- direct item-level audit evidence for checklist items 4.31 and 18.12–18.15;
- continued explicit non-implementation status for Podman, Windows Job Objects, and macOS sandbox;
- inclusion in source reconstruction and release packaging.

Evidence is written to `release/matrix-2.5.0/` and bound to the exact Git commit. Every non-verified checklist item must appear exactly once in `docs/REMAINING-GAPS-2.5.0.md` and the machine-readable remaining-gaps report.
