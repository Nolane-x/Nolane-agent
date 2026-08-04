# Forge Studio 1.6.0 release notes

Date: 2026-07-29

## Trace & Evidence Center

Forge Studio 1.6.0 adds a project-scoped observability and evidence plane for append-only runtime events, verification records, receipt relationships, artifact hashes, failure clusters, claims, and immutable evidence exports.

The server—not the browser—filters events by project, mission, and task; redacts secrets; normalizes failure fingerprints; and derives receipt/artifact/claim graph edges. The UI receives only bounded allowlisted records and never sees local artifact paths, terminal stdin, environment values, hidden reasoning, provider prompts, or credential material.

## Evidence capabilities

- Paginated project/mission/task trace timeline.
- Receipt graph with `derived-from`, `attests`, and `supports` relationships.
- Failure clustering by normalized code and root-cause signature.
- Claim/fact projection with confidence, status, source, and receipt.
- Immutable JSON evidence bundle exported through the content-addressed context store.
- SHA-256 receipts for every snapshot, event page, and export operation.
- Futuristic lazy-loaded UI with Timeline, Receipt Graph, Failures, Claims, and Exports views.

## Release matrix

The mandatory matrix adds `trace-evidence-governance` to all previous governance, runtime, ForgeOS, SDK, IDE, audit, benchmark, reconstruction, packaging, and archive-integrity gates.
