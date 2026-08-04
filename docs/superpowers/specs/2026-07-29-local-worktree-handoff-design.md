# Forge Studio 2.6.0 Local Worktree Handoff Design

## Goal

Close checklist items 27.15 and 27.16 with a local-only, authenticated workflow that prepares a managed task worktree, freezes a content-addressed handoff bundle, and opens that exact worktree in the Forge Studio VS Code extension.

## Scope

The feature supports tasks already stored in Forge Studio. It does not clone repositories, accept arbitrary filesystem paths, move tasks to cloud infrastructure, execute commands after opening the folder, or infer task completion from a handoff.

## Architecture

`LocalTaskHandoffService` is the single authority for local transfer. It resolves a mission and eligible task from durable store records, verifies the task belongs to the mission and project, requires an authenticated principal, delegates workspace creation to `TaskWorkspaceService`, verifies the resulting path is the managed task worktree, and emits an immutable `forge.local-task-handoff.v1` bundle.

The bundle contains stable public IDs, objective, role, status, dependencies, path policy, worktree branch/base reference, dependency handoff receipt hashes, transfer time, principal ID, and a canonical SHA-256 receipt. Only the bounded public bundle is returned through HTTP and persisted in task metadata.

The VS Code extension adds a command that requests the bundle for the active mission, validates the local workspace path and receipt shape, and calls `vscode.openFolder` on that path. It never invokes a shell or accepts a path typed by the user.

## Task Selection

A caller may supply `taskId`. Without it, the service selects the newest eligible builder or integrator task in the mission, preferring a task with an existing managed worktree and then a non-terminal task. A mission with no eligible task fails closed.

## Security Boundaries

- An authenticated principal subject is mandatory.
- The mission, project, and task relationship is checked from durable records.
- Only worktrees created or already recorded by `TaskWorkspaceService` may be returned.
- Existing workspace paths are resolved and checked to exist before release.
- No arbitrary path parameter is accepted by the API.
- The returned metadata excludes secrets through the existing store public projection.
- The operation appends a durable event and stores a content-addressed receipt.

## API

`POST /api/local-task-handoffs`

Request:

```json
{"missionId":"mission-id","taskId":"optional-task-id"}
```

Response: `forge.local-task-handoff.v1` bundle.

`GET /api/local-task-handoffs/:taskId`

Returns the latest persisted public handoff for the authenticated principal's task project, or 404 when absent.

## VS Code Extension

Commands:

- `forge.transferTaskLocal`: prepare the local handoff for the active mission and show a confirmation.
- `forge.openWorktree`: prepare the handoff and open the returned workspace in a new VS Code window.

The extension client exposes `prepareLocalHandoff(missionId, taskId?)` and `getLocalHandoff(taskId)`.

## Error Handling

Unknown mission/task/project, cross-mission task IDs, missing principal, ineligible roles, missing managed worktree, and missing persisted handoff all return coded errors. No task metadata is changed before workspace preparation and path verification succeed.

## Verification

Direct tests cover selection, explicit task validation, authenticated principal enforcement, idempotent worktree reuse, receipt stability, event persistence, route behavior, app wiring, VS Code client behavior, command registration, and `vscode.openFolder`. A fail-closed release gate requires source, tests, API, extension wiring, audit movement for exactly items 27.15 and 27.16, and non-claims for cloud transfer and arbitrary path opening.
