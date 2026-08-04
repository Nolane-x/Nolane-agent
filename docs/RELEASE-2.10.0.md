# Forge Studio 2.10.0 release notes

## Atomic Patch & Change Budget Governance

Forge Studio now exposes `fs.patchSet`, a bounded all-or-rollback transaction for multiple existing files. The transaction verifies file hashes and workspace ownership before writing, rejects duplicate targets, enforces file and changed-line budgets, blocks generated code and protected-comment removal, and applies explicit conflict-marker policy.

Optional formatter execution is isolated to per-file temporary copies. Final output is re-read, re-validated, and represented as minimal unified diffs with additions, deletions, hunk counts, context lines, bytes, and content-addressed receipts. Any write-stage failure restores all original files and modes.

## Audit movement

Ten checklist items move from partial to source-and-test verified: 16.14, 16.22, 16.23, 16.26, 16.27, 16.29, 16.30, 17.13, 17.18, and 17.20. Exact counts are generated in `docs/feature-audit-2.10.0.json`; every remaining non-verified item appears in `docs/REMAINING-GAPS-2.10.0.md`.
