# Forge Studio 2.6.0 verification contract

A 2.6.0 release is valid only when the complete Full Release Matrix runs from gate 1 on a clean committed tree and every required gate passes.

## Local worktree handoff gate

`local-worktree-handoff` must prove:

- authenticated principal binding for prepare and persisted-handoff retrieval;
- mission, project, task, and eligible-role validation;
- managed builder and integrator worktree creation or reuse;
- prevention of project-root fallback for isolated roles;
- managed-worktree existence and execution-workspace identity checks;
- immutable `forge.local-task-handoff.v1` bundle construction;
- content-addressed SHA-256 receipt and durable `task.local-handoff.prepared` event;
- principal-bound and workspace-existence-bound idempotent reuse;
- bounded HTTP input containing only mission and task identity;
- absence of arbitrary path, workspace, worktree, or principal request fields;
- application and HTTP service wiring;
- VS Code client preparation and retrieval methods;
- `forge.transferTaskLocal` and `forge.openWorktree` command contributions;
- absolute-path, schema, and SHA-256 validation before opening;
- use of `vscode.openFolder` without shell or child-process execution;
- direct item-level audit evidence for checklist items 27.15 and 27.16;
- explicit non-claims for repository cloning, arbitrary paths, shell execution, and cloud transfer;
- inclusion in source reconstruction and release packaging.

Evidence is written to `release/matrix-2.6.0/` and bound to the exact Git commit. Every non-verified checklist item must appear exactly once in `docs/REMAINING-GAPS-2.6.0.md` and the machine-readable remaining-gaps report.
