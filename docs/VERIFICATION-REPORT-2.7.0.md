# Forge Studio 2.7.0 verification contract

A 2.7.0 release is valid only when the complete Full Release Matrix runs from gate 1 on a clean committed tree and every required gate passes.

## Code relationship intelligence gate

`code-relationship-intelligence` must prove:

- authenticated principal and known-project binding for indexing and queries;
- use of the vendored TypeScript compiler AST;
- JavaScript, TypeScript, JSX, and TSX declaration indexing;
- class and interface extraction with `extends` and `implements` edges;
- same-file, relative-import, and unique-project-symbol resolution;
- explicit ambiguous and not-found evidence without fabricated edges;
- bounded direction, depth, and result limits;
- contextual local issue references that reject unrelated numeric/hash tokens;
- source/document file-and-line evidence;
- Git commit references bound only to files changed by that commit;
- content-addressed graph and query receipts;
- authenticated API input that cannot supply a workspace root, credential, or remote provider;
- application and HTTP service wiring;
- Inheritance and Issue Links views in the Codebase Knowledge Center;
- direct item-level audit evidence for checklist items 13.15 and 13.19;
- continued `not_implemented` status for Tree-sitter;
- explicit non-claims for language-general parsing, remote issue synchronization, and inferred issue truth;
- inclusion in source reconstruction and release packaging.

Evidence is written to `release/matrix-2.7.0/` and bound to the exact Git commit. Every non-verified checklist item must appear exactly once in `docs/REMAINING-GAPS-2.7.0.md` and the machine-readable remaining-gaps report.
