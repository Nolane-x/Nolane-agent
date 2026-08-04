# Trace & Evidence Center 1.6.0 Design

## Goal

Turn Forge Studio's existing append-only events, verification evidence, receipts, failures, artifacts, and claims into one project-scoped observable evidence plane with a professional lazy-loaded UI.

## Architecture

`TraceEvidenceCenterService` is the sole public aggregation boundary. It reads append-only StudioStore events and evidence, filters them by project/mission/task, redacts secrets, builds a bounded timeline, clusters failures, and derives a receipt graph without exposing local file paths, environment values, raw prompts, or hidden reasoning. Evidence exports are written through `DynamicContextStore`, producing immutable content-addressed artifacts.

The HTTP API binds every request to the authenticated principal. The UI is lazy-loaded and consumes only allowlisted server views. It offers Timeline, Receipt Graph, Failures, Claims, and Exports tabs. It never reconstructs trust or receipt relationships client-side.

## Data flow

1. Runtime components append events and evidence to StudioStore.
2. The center scans events in bounded batches and filters by project references.
3. Evidence records are joined to task/mission context.
4. Receipt, artifact, and claim references are extracted only from known hash fields.
5. Failures are normalized by kind/code/message fingerprint and clustered.
6. Snapshot and export receipts are SHA-256 hashes of canonical public payloads.
7. Export bundles are artifactized with secret redaction and project scope.

## Security and limits

- Authenticated principal is required.
- Unknown project, cross-project evidence, and cross-project artifacts fail closed.
- Event payloads are recursively redacted and depth/size bounded.
- No local paths, process environment, stdin, credential values, hidden reasoning, or raw provider prompts are exposed.
- Pagination, graph nodes, clusters, and export bytes have hard limits.
- Export is read-only; no runtime or repository mutation is available from this center.

## Testing

TDD covers project scoping, pagination, secret redaction, receipt graph edges, failure clustering, immutable artifact export, authenticated HTTP principal binding, app composition, lazy UI, reduced motion, and a dedicated full-release gate.
