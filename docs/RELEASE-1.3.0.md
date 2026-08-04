# Forge Studio 1.3.0 release notes

Date: 2026-07-29

## Diff Review & Partial Accept Center

Forge Studio 1.3.0 adds a hunk-level review surface for changes produced inside managed builder and integrator worktrees. Each file and hunk is derived from a bounded Git snapshot and receives a stable content identity. Users can accept a hunk as reviewed or reject it by applying an exact reverse patch to the candidate worktree; the user's main working tree is never mutated by this workflow.

The professional Diff Review Center displays added, removed, and context lines; file and hunk counts; pending, accepted, and rejected state; decision reasons; actor identity; and receipt evidence. Reject is disabled for add, delete, and rename operations until those file kinds have an atomic partial-rejection implementation.

## Safety properties

- Every decision is bound to an authenticated principal and a trusted workspace.
- The client must submit the exact `reviewSha256` it rendered.
- The server refreshes the candidate Git snapshot immediately before mutation.
- Reverse patching uses the current file SHA-256 as an additional precondition.
- Truncated or oversized diffs are rejected rather than partially reviewed.
- Decisions and mutation receipts are stored in mission metadata and the append-only event ledger.
- A stale snapshot returns `DIFF_REVIEW_STALE`; the UI reloads instead of applying a decision to changed code.

## Release matrix

The mandatory full release matrix adds the `diff-review-governance` gate to the existing version, NolaneNative, workspace trust, runtime, ForgeOS, SDK, IDE, audit, benchmark, reconstruction, packaging, and archive-integrity gates.
