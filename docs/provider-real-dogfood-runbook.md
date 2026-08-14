# Provider-real dogfood runbook

This gate exercises an already-authenticated official provider CLI on a dedicated self-hosted Windows runner without forwarding repository credentials into the provider process.

## Trust boundary

The workflow is manual-only (`workflow_dispatch`) and requires the dedicated labels `self-hosted`, `Windows`, `X64`, and `nolane-provider-dogfood`. The host account owns the CLI session/profile. GitHub checkout persists no credentials and the workflow contains no provider credential secret mapping.

Only providers whose production registry exposes `executionSafety: verified` are eligible. The workflow currently allow-lists `codex`, `claude`, and `gemini`. A provider such as `kimi-code` remains blocked while its registry contract is `external-plan-config-required`; a command-line flag cannot bypass that boundary.

## Evidence contract

The fixed `provider-real-dogfood.v1` profile has 22 sequential cases: 10 behavioral cases and 12 adversarial probes. Each case records only identifiers, timing, exit classification, input SHA-256, result SHA-256, and result byte count. Task text and provider response content are never persisted in the candidate artifact.

The producer emits `nolane.provider-dogfood-candidate.v1` with both:

- `certification_state: candidate_unverified`
- `final_decision: external_gate`

The producer is intentionally incapable of declaring its own candidate a pass. The finalized JSON is validated before upload, uploaded as the only artifact, retained for three days, and the isolated directories are removed on every workflow path.

## Operating procedure

1. Prepare a dedicated Windows x64 runner under a service account and add the `nolane-provider-dogfood` label.
2. Authenticate the chosen official CLI interactively on that host using the service account's own provider session/profile. Do not put that provider credential into GitHub Actions secrets.
3. Confirm the CLI is configured in a bounded read-only/plan mode represented by the production provider registry.
4. Manually dispatch **Provider real dogfood (self-hosted)** and select a currently allow-listed provider. Optionally select a model through the provider's normal safe selector.
5. Review the workflow result and retrieve only the `provider-real-dogfood-candidate-*` artifact.
6. Send that candidate to an independently rooted verifier. The verifier must bind its receipt to the candidate/profile/run provenance and make the final gate decision outside the candidate producer.

## NOL-AUDIT-012

`NOL-AUDIT-012` remains `external_gate` merely because this runner exists or because a candidate is produced. It may move only after a real provider run exists **and** an independent verification receipt satisfies the audit evidence contract. Never hand-edit hashes or relabel candidate evidence to make CI green.
