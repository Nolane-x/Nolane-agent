# Forge Studio 2.9.0 Git Completion Governance Design

## Goal

Turn agent-created Git changes into a bounded, reviewable, content-addressed completion transaction, and detect multi-agent file overlap or merge conflicts before integration.

## Scope

This release covers the local-only checklist cluster for Git remotes, checkpoint commits, agent commits, commit-message governance, selective staging, secret and artifact exclusion, conflict resolution/display, test and residual-risk evidence, cross-agent change tracking, duplicate-file detection, early conflict detection, and per-diff review before merge.

It does not push branches, create remote pull requests, resolve semantic conflicts automatically, or claim that a clean textual merge proves correctness.

## Architecture

### GitCompletionGovernanceService

A project- and principal-bound service owns two durable record types:

1. `forge.git-completion.v1` — one checkpoint or final commit transaction.
2. `forge.git-collision-map.v1` — one mission-level map of changed files, overlaps, merge-tree conflicts, and review coverage.

The service delegates low-level Git mutations to `GitGateway`, reads worktree state through `GitInspector`, and reads hunk review decisions through `DiffReviewService`. It never constructs shell command strings.

### Commit transaction

The transaction requires an expected HEAD and an authenticated principal. It:

1. Validates task/project ownership and task contract permission.
2. Reads remotes and current status.
3. Resolves the requested path set against task `allowedPaths` and `deniedPaths`.
4. Rejects secret findings, generated/build artifacts, dependency directories, archives, database files, and paths outside the managed worktree.
5. Requires at least one passing test receipt for a final commit; checkpoint commits may explicitly record `verificationPending=true`.
6. Requires a bounded list of residual risks, including an explicit empty list when none are known.
7. Generates or validates a one-line conventional-style commit message.
8. Selectively stages only approved paths, commits through `GitGateway`, stores evidence and an event, and returns a content-addressed receipt.

### Multi-agent collision map

For every builder/integrator worktree in a mission, the service records:

- branch, base/head, changed paths, and snapshot hash;
- files changed by multiple tasks;
- pairwise `git merge-tree` conflict evidence without mutating branches;
- diff-review coverage and pending/rejected hunks;
- integration readiness.

Integration readiness is false when any worktree is dirty, any path overlaps without an accepted review record, any merge-tree reports conflicts, or any builder diff has pending/rejected review hunks.

## Data model

Two SQLite tables are created by the service:

- `git_completion_records`
- `git_collision_maps`

Rows are immutable and principal/project scoped. Duplicate idempotency keys return the original receipt only when the request hash matches.

## API and UI

Authenticated API endpoints:

- `POST /api/git-governance/commit`
- `POST /api/git-governance/checkpoint`
- `POST /api/git-governance/collisions`
- `GET /api/git-governance/missions/:missionId`
- `GET /api/git-governance/tasks/:taskId/completions`

A lazy-loaded Git Governance Center shows remotes, commits/checkpoints, tests, residual risks, changed paths, overlaps, merge-tree conflicts, and diff-review readiness. It cannot accept arbitrary repository roots or execute raw Git commands.

## Error handling

All mutation failures are fail-closed. A failed scan, stale HEAD, denied path, missing review, missing verification evidence, duplicate request mismatch, Git conflict, or persistence failure prevents the commit transaction from being reported as complete.

## Verification

Direct tests cover:

- selective staging and artifact/secret exclusion;
- generated commit messages and message rejection;
- checkpoint versus final verification requirements;
- durable test/risk evidence and idempotency;
- remote reads;
- cross-agent path overlap and merge-tree conflict detection;
- diff-review coverage gating;
- authenticated API scope and UI non-shell behavior;
- release gate and exact audit movement.
