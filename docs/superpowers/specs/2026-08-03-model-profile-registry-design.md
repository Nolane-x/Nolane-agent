# Nolane Model Profile Registry Design

## Scope

This change adds a model-specific profile plane only. It does not redesign agent roles, harness execution, or provider transports. The subsystem must describe exact commercial models, open-weight models, local deployments, quantized variants, and unknown newly discovered models without pretending that a static list can remain complete.

## Core architecture

Nolane resolves a model through five ordered layers:

1. **Exact curated profile** — authoritative overrides for important model IDs and aliases.
2. **Provider discovery record** — live data from `/models`, CLI state, Ollama, LM Studio, or OpenAI-compatible endpoints.
3. **Family template** — capabilities and defaults for model families such as Claude, GPT/Codex, Gemini, Qwen Coder, DeepSeek Coder, Devstral/Codestral, StarCoder, Code Llama, Granite Code, Gemma, Phi, Llama, Mistral, GLM, Kimi, MiniMax, Nemotron, and generic local models.
4. **Deployment-variant inference** — parameter count, active MoE parameters, quantization, format, runtime, and hardware estimates parsed from identifiers and discovery metadata.
5. **Safe provisional fallback** — unknown models receive conservative capabilities, explicit uncertainty, provenance, warnings, and no fabricated prices or limits.

This makes the registry open-ended: newly released models can be represented immediately, while curated corrections improve precision over time.

## Model profile schema

Every normalized profile has:

- identity, aliases, provider family, provider model ID, publisher, family, series, version, lifecycle, release date, license, and open-weight status;
- architecture type, total/active parameters, parameter scale, format, quantization, runtime, and local/remote placement;
- context and output limits, tokenizer identity, modalities, role support, caching, compaction, and attachment limits;
- tool calling, parallel calls, strict schemas, structured output, streaming, reasoning controls, prompt caching, batch, citations, computer use, embeddings, fine-tuning, and code specialization;
- coding/reasoning/agentic/debugging/refactor/frontend quality dimensions rather than one provider-wide quality number;
- pricing and account limits with nullable unknown values;
- local RAM/VRAM estimates derived from parameters and quantization, with explicit estimate provenance;
- harness recommendations and compatibility warnings;
- source records, confidence by field, discovery timestamps, verification timestamps, and a canonical SHA-256 receipt.

Unknown facts remain `null`; they are never silently guessed.

## Discovery

`ModelDiscoveryService` supports:

- OpenAI and OpenAI-compatible `GET /v1/models`;
- Anthropic `GET /v1/models` with pagination and capability normalization;
- Gemini `GET /v1beta/models` with page tokens and supported actions;
- Ollama `GET /api/tags` including family, parameter size, and quantization;
- LM Studio `GET /api/v1/models` including architecture, parameter count, size, and quantization;
- CLI model hints supplied by adapters or command output;
- provider-specific fallback paths and bounded timeouts.

Discovery never mutates curated truth directly. It returns normalized candidates that the registry reconciles by precedence and records as discovered profiles.

## Completeness strategy

Literal static enumeration of every hosted alias, fine-tune, community quantization, and future release is impossible. Nolane therefore defines completeness as:

- exact coverage for curated high-value models;
- family coverage for all common commercial and open-weight families;
- generic coverage for any parameter scale, including 0.5B through 1T+, dense and MoE;
- deployment coverage for GGUF, GPTQ, AWQ, EXL2/EXL3, MLX, FP8, BF16, FP16, INT8, and INT4-style names;
- live discovery and import support for catalogs;
- explicit provenance and confidence for every resolved field.

## Public surfaces

- Registry APIs: list, resolve, register discovered profiles, reconcile aliases, compatibility report, export catalog.
- Provider connection APIs: discover models for a configured or proposed connection and resolve the selected model profile.
- HTTP APIs: list/resolve/export model profiles and trigger provider model discovery.
- Export script: writes a deterministic JSON catalog usable without starting Nolane.

## Error handling and security

- Discovery credentials stay in the existing credential vault and are never exported.
- URLs are bounded and normalized; responses have size limits and timeouts.
- Invalid records are rejected individually without losing valid models.
- Capability absence is represented as unknown unless the provider explicitly reports false.
- Deprecated or retired models produce warnings and replacement hints.

## Testing

Tests cover schema validation, immutability, exact/alias/family resolution, 27B/30B/32B parsing, MoE active parameters, quantized RAM estimates, unknown-model fallback, deprecation, catalog export, OpenAI/Anthropic/Gemini/Ollama/LM Studio discovery normalization, pagination, and provider-service integration.
