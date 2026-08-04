# Forge Studio 2.10.0 verification contract

A 2.10.0 release is valid only when the complete Full Release Matrix runs from gate 1 on a clean committed tree and every required gate passes.

## Atomic patch governance gate

`atomic-patch-governance` must prove:

- bounded multi-file preflight with unique paths and expected hashes;
- all-or-rollback file writes with mode preservation;
- generated-code and protected-comment denial;
- reject, preserve, and resolve conflict-marker policies;
- formatter execution on transaction temp files only;
- minimal unified-diff generation and patch-size metrics;
- `fs.patchSet` model schema, ToolBroker wiring, activity tracking, and autonomy enforcement;
- item-level audit evidence for the ten checklist requirements;
- explicit non-claims in `docs/LIMITATIONS-2.10.0.md`;
- inclusion in source reconstruction and release packaging.

All verification evidence is bound to the exact Git commit and written beneath `release/matrix-2.10.0/`.
