# Nolane Agent Model Profile Catalog

## Purpose

The model catalog helps the agent route work using explicit evidence instead of treating every model under one provider as identical. It is not a marketing leaderboard and it does not infer capabilities merely from a model name.

## Evidence layers

A profile contains five distinct evidence layers:

1. **Declared** — conservative family defaults reviewed from provider documentation.
2. **Discovered** — metadata returned by a configured provider model-list endpoint.
3. **Probed** — bounded opt-in behavior checks run by Nolane.
4. **Observed** — sanitized runtime statistics such as latency, success, and cost when available.
5. **User overrides** — explicit local preferences that never include credentials.

Precedence is applied without deleting lower-layer evidence, so Research mode can show where a value came from.

## Capability semantics

**Unknown is not unsupported.**

- `true` means the capability is declared or successfully observed.
- `false` means a bounded request produced evidence classified as unsupported.
- `unknown` means Nolane does not yet have enough evidence.
- `error` is recorded in probe evidence when a transient or unclassified failure occurs; it is not converted into unsupported.

This distinction prevents outages, quota errors, authentication failures, or incomplete provider metadata from permanently degrading a model profile.

## Seed families

`config/model-families.json` contains pattern-based families for major provider ecosystems and local runtimes. Each entry may contain a tokenizer identity, conservative capability defaults, lifecycle metadata, and a source URL to provider documentation. The catalog currently covers OpenAI/Codex, Anthropic/Claude, Google Gemini, xAI, Mistral, DeepSeek, Qwen, Llama, Cohere, Amazon Nova, Microsoft Phi, Ollama, and OpenRouter-style catalogs.

The seed file deliberately avoids brittle exhaustive model IDs. New IDs should arrive through model discovery, a reviewed catalog update, or user configuration.

## Discovery adapters

The discovery layer normalizes common response forms:

- OpenAI-compatible `/models` responses.
- Gemini model-list responses.
- Ollama `/api/tags` responses.
- Generic `data`, `models`, or `items` arrays used by compatible providers.

Failures retain the last known catalog as stale evidence. Credential values are used only for the request and are removed from returned metadata and errors.

## Capability probes

Checkpoint 10 UX Foundation provides opt-in bounded probes for:

- Text completion.
- Tool calling.
- Structured output.
- Streaming availability.

The architecture is extensible for parallel tools, vision, audio, cancellation, and context-threshold probes. Those capabilities remain unknown until a real adapter and bounded test exist.

## Routing integration

Profiles expose provider/model identity, aliases, family, tokenizer, context/output limits, modalities, capabilities, pricing, quota, local-resource metadata, lifecycle, sources, and probe timestamps. Router integration must consume these through a compatibility adapter and preserve `unknown` rather than coercing it to false.

## Privacy and safety

Credential-shaped keys are stripped recursively. Public profile APIs never return API keys, access tokens, refresh tokens, passwords, secrets, or vault references. Discovery and probes are explicit actions and do not silently create or replace provider credentials.

## Maintenance

Provider documentation and live model discovery are both needed:

- Documentation supplies reviewed semantics and stable family guidance.
- Discovery supplies the actual models available to the configured account or local runtime.
- Probes supply bounded behavioral evidence.
- Observations supply local operational evidence.

No single layer is treated as permanent truth.
