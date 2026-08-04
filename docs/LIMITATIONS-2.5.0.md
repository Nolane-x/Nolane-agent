# Forge Studio 2.5.0 — remaining limits

The item-level source of truth is `docs/feature-audit-2.5.0.json`. The exhaustive open-item report is `docs/REMAINING-GAPS-2.5.0.md`.

## Enforcement boundary

Writable Linux cgroup v2 mode provides kernel-enforced CPU, memory, and process-count limits. The watchdog fallback does not throttle CPU or prevent allocation in advance. It samples the process tree and terminates it only after the configured number of consecutive violating samples.

## Disk boundary

Disk enforcement is workspace measurement plus termination after sustained overage. It is not a filesystem quota, loopback filesystem, mount namespace, or per-user operating-system quota. The meter is bounded and deliberately does not follow symbolic links outside the workspace.

## Platform boundary

Windows process-tree observation uses PowerShell/CIM and `taskkill /T /F`; it does not use or claim Windows Job Objects. macOS and generic POSIX observation use `ps`; Forge Studio does not claim macOS sandbox profiles. Podman, process namespaces, network namespaces, filesystem namespaces, and native isolation parity remain outside this release.

## Lifecycle boundary

Only terminal processes launched through Forge's TerminalManager are attached automatically. The authenticated HTTP surface intentionally has no arbitrary PID-attachment endpoint. A restart preserves durable lease evidence but does not claim restoration of an already-running kernel cgroup or watchdog monitor.

## Production boundary

A passing local release gate proves implementation and direct automated tests in this source tree. It is not independent security certification across every host configuration. Authenticode, Apple notarization, hosted cloud conformance, marketplace approval, and independent comparative benchmarks still require external infrastructure or evidence.
