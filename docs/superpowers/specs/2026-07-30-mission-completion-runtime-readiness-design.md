# Forge Studio 2.14.0 Mission Completion & Runtime Readiness Design

## Goal

Close the remaining twenty partial checklist items with direct local behavior while preserving all external gates.

## Architecture

Three bounded services are added.

1. `ArchitectureStageGate` verifies the product stage order `core -> IDE -> desktop -> cloud`, keeps reasoning contracts separate from execution contracts, and creates a resource-governance envelope for every task. Cloud readiness is eligibility only; it does not claim an operated cloud agent.
2. `MissionCompletionOrchestrator` builds and runs an end-to-end local completion workflow for architecture explanation, failing-test repair, dependency repair, Git-conflict resolution, security review, documentation updates, local pull-request review, capability-gated commit, and independent task parallelism. It records one receipt per phase and a canonical final receipt.
3. `LocalContainerPreflightService` probes Docker daemon availability, validates repository mounts, and rejects Docker/Podman socket escape paths without creating a container.

## Data flow

- The architecture gate inspects source artifacts and receives immutable evidence records.
- Mission completion creates a deterministic phase graph. Independent repair tasks may run in parallel; conflict resolution, security review, documentation, local review, and commit remain ordered.
- The orchestrator delegates execution to injected adapters, validates every receipt, and refuses final completion when a required phase fails or a commit capability is absent.
- Container preflight uses `spawn` with argv and `shell:false`; mount and socket checks happen before daemon probing.

## Security and failure behavior

- Principal, project, mission, task and repository identities are required.
- No raw shell strings, arbitrary workspace roots, remote PR creation, force push, cloud sandbox transition or container creation are exposed.
- Every task receives bounded turns, tool calls, tokens and elapsed time.
- Reasoning-only roles cannot be marked as mutation-capable in the governance envelope.
- Commit is skipped unless an explicit capability adapter returns allow.
- Docker socket, Podman socket, Windows Docker named pipe, SSH agent socket and credential directories are denied.

## Verification

Direct tests cover stage order, IDE/desktop evidence, cloud-last eligibility, task resource limits, reasoning/execution separation, phase graph order, parallelism, repair/security/docs/conflict/local-review/commit outcomes, Docker daemon probe, mount policy and socket escape. A dedicated release verifier binds the twenty checklist items to source, tests, audit and Full Release Matrix evidence.
