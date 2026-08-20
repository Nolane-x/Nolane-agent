# Provider Truth and Expanded CLI Catalog

## Decision

Nolane Agent will expose every bundled coding-agent CLI through one truthful
provider contract. A provider is not selectable merely because its executable
exists. The UI must separately show execution safety, model-selection method,
catalog status, and connection state.

The user has already authorized implementation without an approval pause. This
document records that decision and bounds the first vertical slice.

## Scope

1. The Settings model panel renders compact semantic facts on each provider
   card. The facts are textual as well as color-coded, so they work with themes,
   screen readers, and localization.
2. Add five real CLI families found in primary vendor documentation:
   Auggie, Amp, Amazon Q Developer CLI, Crush, and Roo Code CLI.
3. Auggie is offered as a guarded, non-interactive analysis path: print mode,
   quiet JSON output, no saved session, and ask mode (retrieval/non-editing
   tools). It supports login, direct `--model`, and a live JSON model catalog.
4. Amp, Amazon Q, Crush, and Roo are registered as compatible but require a
   vendor-specific safe plan/policy before governed execution. Nolane will
   detect their executable and let the user see their capabilities, but routing
   and connection verification reject them until a safe harness is implemented.

## Non-goals

- Do not fabricate login, model, permission, or JSON flags absent from primary
  documentation.
- Do not make an `external-plan-config-required` provider look ready or permit
  it from the composer.
- Do not package Electron locally, publish a release, or change user data.

## UX contract

Every provider card has an accessible list of facts:

- Execution: `Guarded, read-only`, `Credential-controlled`, or `Safe plan
  configuration required`.
- Models: `Live model catalog`, `Add models manually`, `CLI configuration`, or
  `No model catalog`.
- State: `Not installed`, `Sign in or verify`, `Needs login or test`, or
  `Ready`.

The exact copy is localized in English and Vietnamese. Existing theme tokens
control all colors and spacing; no raw color is added.

## Safety rationale

The relevant vendor docs establish only these claims:

- Auggie supports `--print`, JSON output, `--ask`, `--model`, `models list
  --json`, and `login`; its ask mode is restricted to retrieval/non-editing
  tools.
- Amp execute mode is non-interactive, but the vendor explicitly says it runs
  tools without approval by default.
- Amazon Q supports a non-interactive chat flag, but safe per-tool policy must
  be configured outside this adapter.
- Crush has non-interactive `run`, but exposes flexible provider and permission
  configuration outside Nolane.
- Roo Code CLI is pre-release and, at research time, only ships macOS/Linux
  binaries.

Therefore only Auggie receives a verified guarded profile in this slice. The
other four are deliberately visible-but-blocked rather than falsely runnable.

## Acceptance criteria

- The existing red Settings test passes and captures English/Vietnamese facts.
- Registry tests cover command contracts, model selection, safety policy, and
  the complete deterministic provider order.
- Unsafe compatible CLIs are rejected by existing router/connection safety
  rules without a new bypass.
- UI build and token validation pass.
- Master evidence receipts are regenerated after source/test changes; release
  claims remain bounded by their existing evidence.
