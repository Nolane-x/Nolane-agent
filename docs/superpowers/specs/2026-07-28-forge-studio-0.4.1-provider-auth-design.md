# Forge Studio 0.4.1 Provider Authentication Design

## Goal

Prevent autonomous runs from starting without a usable model, and make provider connection a first-class, simple onboarding flow rather than an advanced technical feature.

## Root cause

Forge Studio 0.4.0 stores credential values but only creates direct API providers from process environment variables at startup. CLI detection checks executable availability, not authentication readiness. Codex app-server exposes account reading but not login/logout through Forge APIs. The default UI hides credentials in the advanced drawer and does not preflight model readiness before creating a run.

## User experience

A new **Kết nối AI** dialog appears on first run or whenever no provider is ready. It presents provider cards with clear states: not installed, sign-in required, connected, testing, or error. The task composer remains simple; after at least one provider is ready, the dialog stays out of the way.

Supported connection paths:

- Codex: ChatGPT browser login, device-code login, Codex-managed API-key login, account status, logout.
- Claude Code: official CLI login launched in a visible terminal, auth-status refresh, logout, plus direct Anthropic API-key provider.
- OpenAI API: direct Responses API with key stored in the OS credential vault.
- Anthropic API: direct Messages API with key stored in the OS credential vault.
- Gemini API: direct GenerateContent API with key stored in the OS credential vault.
- OpenAI-compatible: custom HTTPS/localhost endpoint, model, optional headers, and credential reference.

Google OAuth credentials are never harvested or reused. Forge uses Google models through an API key; official Google CLI authentication remains owned by Google's own client.

## Architecture

`ProviderConnectionService` owns persisted provider definitions, credential references, connection status, testing, and official CLI authentication adapters. `ProviderRegistry` gains safe upsert/removal and explicit detection state. Direct providers resolve secrets server-side for every request.

`POST /api/agent/runs` performs a provider-readiness preflight. If no eligible authenticated provider exists, it returns HTTP 409 with code `provider_setup_required`; no mission or token-consuming model call is created.

## Security

- Plain API keys are accepted only on authenticated loopback POST requests and are immediately stored in the credential vault.
- Provider configuration stored in SQLite contains only secret references.
- Public provider views never include keys, tokens, credential paths, or complete auth output.
- OAuth tokens remain owned by official CLIs.
- API endpoints use fixed command templates; user input never becomes a shell command.
- Custom endpoints require HTTPS except localhost loopback.
- Auth conflicts are surfaced before model calls.

## Routing

A provider is eligible only when it is installed/configured, authenticated, healthy, and has all required capabilities. Failed connection tests update the detection state and prevent routing until retry or cooldown expiry.

## Error handling

Authentication and provider errors are converted into actionable states. Missing provider setup opens the connection dialog instead of showing a failed autonomous task. Existing task failure behavior remains unchanged for runtime errors after a provider passed preflight.

## Testing

Tests cover persisted provider configuration, secret non-disclosure, direct provider request/response normalization, Codex login RPCs, CLI auth status parsing, provider preflight, HTTP routes, and UI wiring. The full Forge Studio and ForgeOS suites remain green before release.
