# Forge Studio 2.6.0 release notes

## Local Worktree Handoff

Forge Studio can now transfer an existing mission task into a managed local builder or integrator worktree. `LocalTaskHandoffService` resolves the task from durable mission records, verifies the authenticated principal and project boundary, creates or reuses the managed worktree through `TaskWorkspaceService`, and emits an immutable `forge.local-task-handoff.v1` bundle.

The bundle freezes the mission and task identity, role, objective, dependencies, allowed paths, execution target, managed worktree identity, repository identity, and prior handoff receipts. Its receipt is content-addressed with SHA-256. Repeated preparation is idempotent only when the same principal owns the existing handoff and the managed workspace still exists.

## Managed builder and integrator worktrees

Both builder and integrator roles now require isolated managed worktrees. They cannot silently fall back to the project root. The service verifies that the prepared execution workspace matches the public managed-worktree record and that the path exists before persisting the handoff.

Preparing a local handoff does not execute the task, run a terminal, clone a repository, or mark the task complete. It changes the governed continuation target to local and records `task.local-handoff.prepared` with a content-addressed receipt.

## Authenticated API and VS Code flow

The authenticated HTTP surface accepts only `missionId` and optional `taskId`. It never accepts a local workspace, worktree path, repository path, or principal from request content. Principal identity is derived from the authenticated server session, and persisted handoff retrieval is principal-bound.

The VS Code extension adds two commands:

- `Forge: Transfer Task to Local` prepares the bounded handoff bundle for the active mission.
- `Forge: Open Managed Worktree` validates the bundle schema, absolute managed path, and SHA-256 receipt before calling `vscode.openFolder`.

The extension helper does not invoke `child_process`, execute a shell, clone a repository, or accept a manually entered path.

## Release governance

The required `local-worktree-handoff` gate verifies principal binding, builder/integrator isolation, content-addressed idempotent handoff, bounded API input, application wiring, VS Code command contribution, safe `vscode.openFolder` use, item-level audit movement, explicit non-claims, and Full Release Matrix inclusion.

## Audit movement

Exactly two checklist items moved from `not_implemented` to `verified_source_test`:

- 27.15 — Hỗ trợ mở worktree trong IDE
- 27.16 — Hỗ trợ chuyển task sang local

The audit total is 639 verified, 91 partial, 52 external-gated, and 8 not implemented out of 790. Integrated browser, secrets manager, inheritance graph, issue indexing, Tree-sitter, Podman, Windows Job Objects, and macOS sandbox support remain explicitly not implemented.
