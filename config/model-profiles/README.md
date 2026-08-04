# Nolane Model Profile Registry

This directory contains the deterministic, profile-only catalog exported by Nolane.

## Coverage model

The bundled catalog is deliberately not presented as a permanent list of every model on Earth. It combines:

1. curated exact profiles for high-value commercial, frontier, coding, open-weight, and local models;
2. family templates for known model lines;
3. parameter-size templates from sub-1B through 1T+;
4. deployment inference for dense/MoE, GGUF, AWQ, GPTQ, EXL2/EXL3, MLX, FP8/BF16/FP16, INT8/INT4 and Q2-Q8 names;
5. live imports from models.dev, OpenRouter, LiteLLM, and Portkey;
6. provider discovery from OpenAI-compatible, Anthropic, Gemini, Ollama, and LM Studio endpoints;
7. a conservative provisional profile for unknown future models.

Unknown context limits, output limits, prices, quotas, or capabilities remain `null`. A profile never turns an estimate into an authoritative fact.

## Commands

```bash
npm run profiles:test
npm run profiles:export
npm run profiles:export -- ./path/to/catalog.json
```

## Resolution precedence

`exact curated > live provider observation > imported provider deployment > family template > size template > provisional fallback`

Base-model identity and provider deployment are separate. The same open-weight model can be self-hosted, served through an API, quantized differently, or exposed with different context/tool limits.

## Security

Exports contain no API keys, authorization headers, cookies, credentials, or credential-vault references.
