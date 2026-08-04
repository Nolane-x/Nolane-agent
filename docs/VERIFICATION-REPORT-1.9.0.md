# Forge Studio 1.9.0 verification contract

A 1.9.0 release is valid only when the complete Full Release Matrix runs from gate 1 on a clean committed tree and every required gate passes.

## Codebase Knowledge gate

`codebase-knowledge-graph` must prove:

- route and API endpoint detectors;
- database model detectors;
- import, reference, conservative call, and test edges;
- bounded Git history;
- bounded regex controls;
- content-hash incremental reuse;
- portable watcher lifecycle;
- dependency-distance, Git-recency, and test-relation ranking;
- adaptive retrieval integration;
- authenticated API and lazy UI;
- source packaging and reconstruction.

## Release evidence

Evidence is written to `release/matrix-1.9.0/` and bound to the exact Git commit. Every gate has an exit code, duration, stdout/stderr digests, and receipt SHA-256.

Every non-verified checklist item must appear exactly once in `REMAINING-GAPS-1.9.0.md` and the machine-readable release report, with status, reason, current evidence, and completion condition.
