# Forge Studio 2.3.0 verification contract

A 2.3.0 release is valid only when the complete Full Release Matrix runs from gate 1 on a clean committed tree and every required gate passes.

## Local semantic dependency intelligence gate

`local-semantic-dependency-intelligence` must prove:

- a built-in local feature-hash embedding provider;
- hybrid semantic and lexical ranking with explicit score breakdowns;
- bounded query length, result count, and code preview length;
- authenticated principal-bound and project-scoped APIs;
- incoming, outgoing, and bidirectional dependency traversal;
- bounded traversal depth, node count, and edge count;
- root, leaf, degree, test-relation, and cycle projection;
- content-addressed evidence receipts;
- application lifecycle wiring;
- lazy-loaded Semantic Search and Dependencies surfaces;
- direct item-level audit evidence for checklist items 4.23 and 13.21;
- inclusion in source reconstruction and release packaging.

Evidence is written to `release/matrix-2.3.0/` and bound to the exact Git commit. Every non-verified checklist item must appear exactly once in `docs/REMAINING-GAPS-2.3.0.md` and the machine-readable remaining-gaps report.
