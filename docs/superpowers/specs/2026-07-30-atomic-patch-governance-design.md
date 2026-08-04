# Atomic Patch & Change Budget Governance Design

## Goal

Add a local, project-bound `fs.patchSet` transaction that applies multiple unified patches as one all-or-rollback operation, formats only touched files, protects generated code and important comments, enforces file/line budgets, understands conflict markers, emits minimal diffs, and records patch-size evidence.

## Architecture

`AtomicPatchTransactionService` owns validation, dry-run projection, formatter execution, rollback, minimal-diff generation, and immutable receipts. `ToolBroker` exposes the service as `fs.patchSet` and supplies the existing workspace policy, command allowlist, and receipt envelope. The service never accepts shell strings and never formats a directory or whole repository.

## Transaction flow

1. Validate 1–32 unique existing project-relative files and total changed-line budget.
2. Read every file and verify expected SHA-256 before any write.
3. Parse and dry-run every unified patch in memory.
4. Reject generated paths/content, removed protected comments, malformed or disallowed conflict markers, excessive context, and budget overruns.
5. Write all candidate contents through temporary files while preserving file modes.
6. Run an optional allowlisted formatter once per touched file with an argv template containing exactly one `{file}` placeholder.
7. Re-read final contents, verify formatter scope and protected-comment/conflict policy again, then generate minimal unified diffs and metrics.
8. On any error, restore every original file and mode; return no successful transaction receipt.

## Conflict-marker policy

- `reject` (default): final files may not contain conflict markers.
- `preserve`: well-formed pre-existing conflict blocks may remain, but new blocks are forbidden.
- `resolve`: at least one well-formed block must exist before and no block may remain after.

## Safety boundaries

- Existing regular UTF-8 files only; create/delete/rename remain separate tools.
- No shell command strings, arbitrary working directories, whole-project formatter arguments, generated-code override, or comment-protection bypass.
- “Atomic” means deterministic all-or-rollback at the Forge transaction layer, not a claim of a multi-file filesystem atomic primitive.

## Verification

Direct tests cover successful multi-file commits, stale hashes, duplicate paths, file/line budgets, generated-code denial, protected-comment preservation, conflict-marker policies, formatter scope, formatter failure rollback, write failure rollback, minimal diff generation, metrics, ToolBroker receipts, tool schema, autonomy policy, release audit, and full release matrix inclusion.
