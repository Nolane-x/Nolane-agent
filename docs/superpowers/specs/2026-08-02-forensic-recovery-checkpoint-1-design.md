# Nolane Agent Forensic Recovery Checkpoint 1 Design

**Status:** Approved by the user on 2026-08-02 through the instruction to proceed with the complete recovery plan checkpoint by checkpoint.

## Goal

Replace self-referential parity claims with reproducible evidence at archive, symbol, command, route, configuration, UI-surface, and assertion level. The checkpoint must also remove the known fail-open verifier behavior and publish a machine-readable list of everything that remains unverified.

## Scope

Checkpoint 1 completes every recovery task that can be proven from the current Nolane source and the available historical legacy external runtime manifests/ledgers. It does not fabricate an upstream NolaneNative symbol inventory when the canonical NolaneNative archive bytes are unavailable.

### Included

1. Immutable source-custody manifest and claim freeze.
2. Generic ZIP/TAR decomposition and fair size classification.
3. Nolane JS/TS symbol, command, route, event, schema, configuration, and UI-action inventory.
4. Provisional NolaneNative path inventory imported from historical transformation ledgers, explicitly marked `source-bytes-unavailable`.
5. New counterpart/truth ledger with fail-closed states.
6. Evidence-quality rules that prohibit documentation-only production entrypoints and unbounded evidence reuse.
7. VerifierMesh registration and execution changed from fail-open to fail-closed.
8. UI v3 master-plan gap registry and default-UI claim audit.
9. Checkpoint gate, reports, artifacts, hashes, and source package.

### Excluded until canonical bytes or real environments are present

- Function-level parsing of the canonical NolaneNative archive.
- Provider-real, messaging-real, Windows, NVDA/Narrator, signing, and independent comparative certification.
- Any claim that Nolane has complete NolaneNative parity or is superior to NolaneNative.

## Architecture

### Forensic source layer

`src/forensics/source-custody.mjs` produces immutable source records containing path, bytes, SHA-256, origin, and availability. `src/forensics/archive-decomposer.mjs` classifies every archive entry into production source, test, documentation, asset, vendor/dependency, generated data, binary/build output, nested archive, or unknown.

### Symbol inventory layer

`src/forensics/symbol-inventory/` contains language-specific extractors. The JavaScript/TypeScript extractor uses the already installed parser stack when available and a deterministic lexical fallback only for unsupported syntax. Every record includes a stable ID, file hash, symbol kind, name, exported state, signature summary, line range, and detected surfaces such as CLI command, HTTP route, event, configuration key, schema, or UI action.

Historical NolaneNative ledgers are imported by `nolane_native-ledger-importer.mjs`, but every imported entry is tagged as provisional and cannot be classified as `exact` or `superset` without canonical source bytes or black-box evidence.

### Truth ledger layer

The ledger state machine is:

- `exact`
- `superset`
- `partial`
- `absent`
- `excluded-with-reason`
- `external-unverified`
- `upstream-source-unavailable`

Only `exact`, `superset`, and justified exclusions count as resolved. All other states block complete parity.

### Verification layer

Verifier registration requires a callable `evaluate` function. A verifier that throws, returns no decision, returns an invalid decision, or is unavailable produces an explicit `error` or `abstain` decision and the aggregate status can never become `pass` from that verifier. A complete pass requires at least one valid pass and no fail/error/abstain decision required by policy.

### UI gap layer

The UI audit compares source files and registered capabilities with the supplied UI/UX Master Plan. It emits implemented, partial, missing, and external-certification items. It also checks whether UI v3 is the packaged default, whether heavy surfaces are lazy, and whether required accessibility/performance scripts exist.

## Data flow

1. Pin current source and all available historical artifacts.
2. Decompose available archives.
3. Generate Nolane symbol/surface inventory.
4. Import provisional NolaneNative paths.
5. Build counterpart ledger using explicit mapping records only.
6. Run evidence-quality and verifier fail-closed gates.
7. Generate UI gap report.
8. Generate Checkpoint 1 report and release artifacts.

## Error handling and claim policy

- Missing canonical upstream archive is a recorded blocker, not a silent fallback.
- Parser failures are reported per file and block the affected file from being counted complete.
- Unknown archive classifications remain visible and block “100% classified.”
- Documentation and tests cannot be accepted as production entrypoints.
- No fixture or mock can unlock provider-real, Windows-real, or comparative claims.
- All prior complete-parity and superiority flags remain false.

## Testing strategy

- Unit tests for archive classification, stable IDs, symbol extraction, NolaneNative provisional import, truth-ledger transitions, and UI gap detection.
- Negative tests for malformed archives, missing evaluators, thrown evaluators, invalid decisions, docs-only evidence, duplicate mappings, and absent canonical source.
- Integration tests run against the actual Nolane repository tree.
- A release gate requires deterministic repeated generation and hash equality.
- Full project regression and release matrix run after targeted tests pass.

## Exit criteria

1. Known fail-open verifier behavior is eliminated and regression-tested.
2. Current Nolane production source is inventoried at symbol/surface level with zero silent parse failures.
3. NolaneNative entries without source bytes are explicitly provisional and cannot unlock parity.
4. Truth ledger reports exact counts of resolved, partial, absent, external, unavailable, and unmapped entries.
5. UI v3 gaps are machine-readable and claims remain locked.
6. Checkpoint artifacts, source ZIP, evidence bundle, manifest, and SHA-256 file pass integrity checks.
