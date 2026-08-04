# Forge Studio 2.14.0 release notes

## Mission Completion & Runtime Readiness

Forge Studio now verifies the product-stage order `core -> IDE -> desktop -> cloud eligibility`, attaches a canonical resource and reasoning/execution envelope to every planned task, and provides an authenticated local completion workflow. The workflow explains architecture, schedules failing-test and dependency repair in parallel, then orders Git-conflict resolution, security review, documentation updates, local pull-request review, and an optional capability-gated commit.

A new local container preflight probes `docker info` with argv and `shell: false`, validates project-contained mounts, rejects writable sensitive destinations, and blocks Docker, Podman, SSH-agent, and credential socket escape paths. It does not create a container.

## Audit movement

Twenty checklist items move from partial to source-and-test verified: 1.2, 1.3, 1.4, 1.14, 1.18, 1.23, 2.3, 2.10, 2.14, 2.15, 2.16, 2.18, 2.19, 2.20, 2.29, 4.3, 7.22, 21.11, 21.12, and 21.14. The generated audit contains 734 verified items, zero partial items, 56 external gates, and zero not-implemented items.
