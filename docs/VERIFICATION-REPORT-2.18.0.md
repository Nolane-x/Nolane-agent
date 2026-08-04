# Forge Studio 2.18.0 verification report

## Contract

Release acceptance requires a clean committed source tree and a passing Full Release Matrix. The new `adaptive-harness-lab` gate verifies provider-family profiles, deterministic request composition, schema preservation, privacy-bounded failure telemetry, AgentLoop and evaluation wiring, replay rejection/promotion/rollback, raw measurement, unchanged item-level audit counts, composition budgets and explicit non-claims.

## Direct focused evidence

- Registry tests prove distinct family resolution, generic fallback, deep immutability, profile validation, exact-hash promotion and rollback.
- Composer tests prove provider-specific guidance and ordering while preserving tool parameter JSON schemas and input immutability.
- Failure tests prove deterministic classification and rejection of raw prompt, model output and environment fields.
- Experiment tests prove weak candidates fail on critical regression and strong candidates require measurable non-regressing replay evidence.
- AgentLoop tests prove every attempt is recomposed, classified failures are recorded before retry/fallback, and public events contain profile identity rather than hidden reasoning.
- Composition tests prove the application owns the whole subsystem through one lifecycle facade and closes its SQLite store.

## Release result

The final gate count, commit and artifact receipts are written by `release/matrix/full-release-matrix.json` and `release/matrix/full-release-matrix.md`. This document is not independent certification of provider quality, Windows/macOS production behavior, cloud sandboxes, hosted PR/CI, process-tree cost attribution or full browser journey completion.
