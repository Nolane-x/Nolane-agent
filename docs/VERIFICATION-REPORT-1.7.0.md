# Forge Studio 1.7.0 verification contract

Date: 2026-07-29

The required command is:

```bash
npm run release:matrix
```

Evidence is written to `release/matrix-1.7.0/`, bound to the exact Git commit, and every required gate must pass.

## Repository discovery evidence

- Source-language and toolchain detection with relative-path, line, and SHA-256 evidence.
- Secret-path exclusion and no absolute path disclosure.
- Explicit unknowns for unsupported findings.
- Authenticated project-scoped HTTP API.
- Lazy Repository Intelligence Center UI.
- Dedicated `repository-discovery-intelligence` release gate.

## Remaining-gaps evidence

- Every non-verified feature-audit item must appear exactly once.
- Each item must include status, reason, evidence, and completion condition.
- Tracked Markdown must exactly match deterministic generation.
- Machine-readable JSON is generated for the release.
- Source archives must contain the report.
- Dedicated `remaining-gaps-report` release gate.

The full matrix also runs every prior governance, runtime, NolaneNative, ForgeOS, SDK, IDE, audit, benchmark, reconstruction, packaging, and archive-integrity gate.
