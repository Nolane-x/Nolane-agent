# Forge Studio 2.4.0 verification contract

A 2.4.0 release is valid only when the complete Full Release Matrix runs from gate 1 on a clean committed tree and every required gate passes.

## Local AST intelligence gate

`local-ast-intelligence` must prove:

- pinned vendored TypeScript 5.8.3 compiler identity and license provenance;
- bounded JavaScript, TypeScript, JSX, and TSX parsing;
- AST query by syntax kind with optional name, ancestor, and text filters;
- bounded result count and preview length;
- source, node, replacement, result, and receipt SHA-256 evidence;
- exactly-one-node selection and stale-file/stale-node rejection;
- generated-code denial;
- dry-run and full resulting-source syntax reparse;
- atomic same-directory write with mode and line-ending preservation;
- task-authorized Operating Plane schemas and execution;
- HTTP routes and application lifecycle wiring;
- observable AST Intelligence controls in the Codebase Knowledge Center;
- direct item-level audit evidence for checklist items 13.26 and 16.3;
- continued explicit non-implementation status for Tree-sitter;
- inclusion in source reconstruction and release packaging.

Evidence is written to `release/matrix-2.4.0/` and bound to the exact Git commit. Every non-verified checklist item must appear exactly once in `docs/REMAINING-GAPS-2.4.0.md` and the machine-readable remaining-gaps report.
