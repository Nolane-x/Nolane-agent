# Forge Studio 1.3.0 verification contract

Date: 2026-07-29

The required command is:

```bash
npm run release:matrix
```

Evidence is written to `release/matrix-1.3.0/` and bound to the exact Git commit. Every gate emits a content-addressed receipt and every required gate must pass.

## Diff-review evidence

- Stable parsing and identity for bounded multi-file Git diffs.
- Authenticated, actor-bound accept and reject decisions.
- Trusted-workspace requirement for mutating decisions.
- Exact expected review hash and current Git snapshot checks.
- Exact single-hunk reverse patch with current file hash precondition.
- Rejection of truncated, oversized, stale, anonymous, invalid, or unknown-hunk input.
- Authenticated HTTP APIs and application composition.
- Lazy-loaded professional UI with stale-refresh handling and disabled unsupported mutations.

## Complete release boundary

The matrix also runs the complete Node suite, syntax validation, authenticated smoke, deterministic evaluation, VS Code build, Go modules, Python SDK, all ForgeOS validation and conformance gates, the 790-item audit, benchmark claim lock, project manifest generation, Windows bootstrap, source and IDE packaging, fresh-source reconstruction, and archive integrity.
