# Forge Studio 0.2.0 verification report

Verification date: 2026-07-28.

## Fresh commands

```bash
npm run validate
npm run smoke
npm test
cd vendor/forge-os && npm test
```

## Results

- Forge Studio: **96 tests passed, 0 failed**.
- ForgeOS: **389 tests passed, 0 failed**.
- Source syntax check: passed.
- Source startup smoke: passed on loopback.
- Staged portable startup: passed.
- Staged portable `/health`: HTTP 200 with version `0.2.0`.
- Staged portable authenticated `/api/projects`: HTTP 200.
- Windows launcher format: PE32+ GUI, x86-64.
- Windows package mode: verified first-run Node runtime bootstrap because the build environment could not resolve `nodejs.org`.

## Covered failure modes

The automated suite includes budget exhaustion, cancellation, provider fallback, malformed tool JSON, MCP timeout/cancellation, undeclared MCP tools, path traversal, symlink escape, stale file hashes, patch conflicts, command denial, output truncation, process timeout, DAG cycles, overlapping path ownership, stale fencing tokens, expired leases, invalid planner output, missing independent review, failed verification commands, durable interrupt token reuse, invalid memory promotion, Web robots/cache behavior, staged dependency closure, and no-progress autopilot.

## Interpretation

The results establish that the implemented contracts behave as tested in this Linux build environment. They do not establish coding benchmark superiority, Windows runtime compatibility on every machine, production security, or reliability under large distributed workloads. Those require separate environment and benchmark evidence.
