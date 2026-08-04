# Nolane Agent 5.0 Design

## Goal

Transform the certified Forge Studio 4.0.0 source into **Nolane Agent**, while preserving historical evidence, rebuilding NolaneNative-derived behavior behind independent Nolane contracts, and replacing the legacy renderer with a progressive Workspace and Control Plane.

## Source basis

This design is grounded in three project documents preserved under `docs/reference/`:

- the two-layer Workspace / Control Plane UI architecture and Quiet Authority design language;
- the independent audit requiring critical-path quarantine, clean-room releases, Gitless discovery, real benchmark lanes and evidence freshness;
- the small-model research program requiring typed state, verifier-first learning, held-out evaluation and governed promotion before training claims.

## Non-negotiable rules

1. **Nolane Agent is canonical.** Legacy names are compatibility inputs or historical provenance only.
2. **Historical receipts are immutable.** A rebrand may read and verify them but never rewrite their signed bytes.
3. **NolaneNative is reference material, not a hidden runtime dependency.** Every replacement capability needs a Nolane entrypoint, Nolane tests, clean-room replay and provenance.
4. **`not_implemented` is a first-class status.** A file or interface does not count as complete.
5. **Production UI v3 fails closed.** It never silently falls back to a missing build in production.
6. **No external renderer assets.** UI source, styles and modules are local and hashed.
7. **No fake progress or benchmark claims.** Percentages require measurable totals; capability claims require hidden or independent evidence.

## Architecture

### Product identity

`config/product-identity.json` is the canonical identity root. New code imports `src/product-identity.mjs`. Legacy names are accepted only through explicit migration readers.

### UI v3

The renderer is built from `ui-v3/` into `ui-dist/` with deterministic hashed assets. `src/ui/ui-root-resolver.mjs` selects v2 or v3. The AppShell persists rail and session identities while route content changes.

### Requirement acceptance ledger

`requirements/nolane-agent-v5-requirements.json` contains named requirements and one of:

- `not_implemented`;
- `implemented_not_wired`;
- `verified_source_test`;
- `external_gate`.

Every verified item binds an entrypoint SHA-256, exact-test SHA-256 and deterministic replay receipt.

### NolaneNative transformation program

`requirements/nolane-native-transformation-ledger.jsonl` accounts for every ZIP entry. Each entry receives one action:

- `reimplement`;
- `rewrite-test`;
- `rewrite-doc`;
- `respecify-config`;
- `replace-asset`;
- `retain-license`;
- `exclude-with-reason`.

Directories and excluded files remain accounted for. MIT license and Nous Research attribution remain intact.

## Current accepted slice

The current slice includes:

- canonical Nolane identity;
- deterministic UI v3 build and fail-closed root selection;
- persistent AppShell/router;
- Session Sidebar model with stable row identity and recent-session virtualization;
- Home Mission Composer with enforceable intent boundaries;
- incremental Mission Workspace state with activity windowing;
- human-readable permission/approval cards;
- complete NolaneNative archive inventory and transformation program.

## Deferred areas

Review, Workroom, Control Plane routes, full product-surface rebrand, clean-room 5.0 release, native NolaneNative replacements, model-training programs and independent benchmark certification remain explicitly `not_implemented` until their acceptance evidence exists.
