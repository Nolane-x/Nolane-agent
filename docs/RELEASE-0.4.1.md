# Forge Studio 0.4.1 release notes

## Provider Connection Center

Version 0.4.1 fixes the provider-authentication gap that could let a task enter planning before any usable model was connected.

### Added

- First-class AI connection dialog in the default chat interface.
- Codex ChatGPT/browser and device-code login through Codex app-server.
- Claude Pro/Max and Anthropic Console login through the official Claude CLI.
- Direct OpenAI Responses, Anthropic Messages and Gemini GenerateContent providers.
- OpenAI-compatible HTTPS providers and keyless loopback endpoints.
- Secure API-key aliases backed by the operating-system credential vault.
- Provider connection testing, health, refresh, logout and deletion APIs.
- Provider readiness preflight before run creation.
- Lazy-loaded provider UI to keep the default shell below its 100 KB eager budget.

### Fixed

- Saving a credential no longer leaves it disconnected from the provider registry.
- Installed but unauthenticated coding CLIs are no longer considered routable.
- Missing provider configuration now returns `provider_setup_required` before mission creation.
- The task draft is preserved when the connection dialog opens.
- Provider/API errors are redacted and never contain the configured key.

### Security properties

- OAuth/session tokens owned by official CLIs are not extracted.
- API keys are not persisted in SQLite or browser storage.
- Remote custom endpoints must use HTTPS; HTTP is accepted only on loopback.
- A provider is not eligible for routing until authenticated and connection-tested.
