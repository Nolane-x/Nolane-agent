# Provider-real dogfood self-hosted design

## Objective

Recover the provider-real dogfood capability as a fail-closed external evidence producer. The capability must run through the production provider registry, use an already-authenticated provider CLI session on a dedicated host, and produce a content-free candidate that cannot self-certify.

## Invariants

- Trigger is manual-only.
- Host labels are `self-hosted`, `Windows`, `X64`, `nolane-provider-dogfood`.
- Repository checkout uses `persist-credentials: false`.
- Provider credentials belong to the host CLI profile, not GitHub Actions inputs or secrets.
- Provider selection resolves through `ProviderRegistry` populated by `createBuiltInCliProviders()`.
- Any provider whose `executionSafety` is not `verified` is rejected before profile execution.
- The profile is stable and hash-bound: 22 sequential cases, split 10 behavioral / 12 adversarial.
- Every attempted case receives teardown even after provider failure.
- Candidate persistence is hash/metadata-only; task text, provider response text, diagnostics, and conversation content are absent.
- Candidate state is permanently `candidate_unverified` / `external_gate`.
- The candidate producer never decides `pass`.
- An independent verifier is required to close an external audit gate.

## Failure semantics

Provider non-zero exit, timeout, cancellation, invocation exception, or teardown exception becomes a generic per-case failure code. Raw provider diagnostics are not copied into evidence. The runner continues the bounded profile so a failure cannot suppress teardown or the remaining observations.

The CLI wrapper has two explicit acknowledgements: a command flag and the host environment guard. Under GitHub Actions, any event other than `workflow_dispatch` is rejected. Unknown or unsafe providers are rejected before candidate execution.

The candidate is validated before its atomic write. The workflow runs validation again before publishing and uploads exactly one short-lived JSON artifact. Execution or validation failure leaves the job failed even when a valid candidate is retained for independent diagnosis.

## Certification boundary

This component is an evidence **producer**, not an evidence **authority**. A real run is necessary but insufficient for `NOL-AUDIT-012`. The final transition requires an independently rooted receipt that verifies candidate integrity, run provenance, profile binding, and the applicable audit policy.
