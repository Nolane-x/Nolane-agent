function nullableNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function perTokenToMillion(value) {
  const number = nullableNumber(value);
  return number == null ? null : Math.round(number * 1_000_000 * 1e9) / 1e9;
}

function modalityFlags(values, defaults = {}) {
  const set = new Set(Array.isArray(values) ? values.map((x) => String(x).toLowerCase()) : []);
  return {
    text: set.size ? set.has('text') : defaults.text ?? null,
    image: set.has('image') || set.has('images') ? true : set.size ? false : defaults.image ?? null,
    audio: set.has('audio') ? true : set.size ? false : defaults.audio ?? null,
    video: set.has('video') ? true : set.size ? false : defaults.video ?? null,
    files: set.has('file') || set.has('files') || set.has('pdf') ? true : set.size ? false : defaults.files ?? null,
  };
}

function source(type, providerId, observedAt) {
  return { type, providerId: providerId ?? null, observedAt: observedAt ?? null };
}

export function normalizeModelsDevCatalog(payload, { observedAt = null } = {}) {
  const records = [];
  const providers = payload?.providers ?? payload ?? {};
  for (const [providerKey, providerValue] of Object.entries(providers)) {
    if (!providerValue || typeof providerValue !== 'object') continue;
    const providerId = providerValue.id ?? providerKey;
    const models = providerValue.models ?? {};
    const entries = Array.isArray(models) ? models.map((model) => [model.id, model]) : Object.entries(models);
    for (const [modelKey, model] of entries) {
      if (!model || typeof model !== 'object') continue;
      const providerModelId = model.id ?? modelKey;
      if (!providerModelId) continue;
      const params = new Set(model.supported_parameters ?? model.parameters ?? []);
      const inputModalities = model.modalities?.input ?? model.input_modalities ?? [];
      const outputModalities = model.modalities?.output ?? model.output_modalities ?? [];
      records.push({
        id: String(model.base_model ?? model.baseModel ?? providerModelId).toLowerCase(),
        baseModelId: model.base_model ?? model.baseModel ?? null,
        providerFamily: String(providerId).toLowerCase(),
        providerModelId: String(providerModelId),
        identity: { family: model.family ?? null, displayName: model.name ?? null },
        context: {
          contextWindow: nullableNumber(model.limit?.context ?? model.context_window ?? model.contextWindow),
          maxInputTokens: nullableNumber(model.limit?.input ?? model.max_input_tokens),
          maxOutputTokens: nullableNumber(model.limit?.output ?? model.max_output_tokens),
        },
        modalities: { input: modalityFlags(inputModalities, { text: true }), output: modalityFlags(outputModalities, { text: true }) },
        capabilities: {
          reasoning: model.reasoning ?? params.has('reasoning') ? true : null,
          structuredOutput: model.structured_output ?? params.has('structured_outputs') ?? null,
          streaming: model.streaming ?? null,
          promptCaching: model.caching ?? null,
          embeddings: model.mode === 'embedding' ? true : null,
        },
        toolCalling: {
          supported: model.tool_call ?? model.toolCalling ?? params.has('tools') ? true : null,
          parallel: model.parallel_tool_call ?? null,
          strictSchema: model.structured_output ?? params.has('structured_outputs') ? true : null,
          toolChoice: params.has('tool_choice') ? true : null,
        },
        reasoning: { supported: model.reasoning ?? params.has('reasoning') ? true : null },
        pricing: {
          inputPerMillion: perTokenToMillion(model.cost?.input ?? model.pricing?.input),
          outputPerMillion: perTokenToMillion(model.cost?.output ?? model.pricing?.output),
          cachedInputPerMillion: perTokenToMillion(model.cost?.cache_read ?? model.pricing?.cached_input),
        },
        lifecycle: { status: model.status ?? 'unknown' },
        source: source('models.dev', providerId, observedAt),
      });
    }
  }
  return records;
}

export function normalizeOpenRouterCatalog(payload, { observedAt = null } = {}) {
  return (payload?.data ?? []).filter((model) => model?.id).map((model) => {
    const params = new Set(model.supported_parameters ?? []);
    return {
      id: String(model.id).toLowerCase(),
      baseModelId: model.canonical_slug ?? model.id,
      providerFamily: 'openrouter',
      providerModelId: model.id,
      identity: { displayName: model.name ?? null, releaseDate: model.created ? new Date(model.created * 1000).toISOString().slice(0, 10) : null },
      context: {
        contextWindow: nullableNumber(model.context_length),
        maxOutputTokens: nullableNumber(model.top_provider?.max_completion_tokens),
      },
      modalities: {
        input: modalityFlags(model.architecture?.input_modalities, { text: true }),
        output: modalityFlags(model.architecture?.output_modalities, { text: true }),
      },
      capabilities: {
        reasoning: params.has('reasoning') || params.has('include_reasoning') ? true : null,
        structuredOutput: params.has('structured_outputs') || params.has('response_format') ? true : null,
        streaming: true,
        promptCaching: model.pricing?.input_cache_read != null ? true : null,
      },
      toolCalling: {
        supported: params.has('tools') ? true : null,
        parallel: params.has('parallel_tool_calls') ? true : null,
        strictSchema: params.has('structured_outputs') ? true : null,
        toolChoice: params.has('tool_choice') ? true : null,
      },
      reasoning: { supported: params.has('reasoning') || params.has('include_reasoning') ? true : null },
      pricing: {
        inputPerMillion: perTokenToMillion(model.pricing?.prompt),
        outputPerMillion: perTokenToMillion(model.pricing?.completion),
        cachedInputPerMillion: perTokenToMillion(model.pricing?.input_cache_read),
        cacheWritePerMillion: perTokenToMillion(model.pricing?.input_cache_write),
      },
      lifecycle: { status: model.expiration_date ? 'scheduled-retirement' : 'active', retirementAt: model.expiration_date ?? null },
      source: source('openrouter-service-catalog', 'openrouter', observedAt),
    };
  });
}

export function normalizeLiteLlmCatalog(payload, { observedAt = null } = {}) {
  return Object.entries(payload ?? {}).filter(([, value]) => value && typeof value === 'object').map(([id, model]) => ({
    id: String(id).toLowerCase(),
    baseModelId: model.base_model ?? null,
    providerFamily: model.litellm_provider ?? id.split('/')[0] ?? 'litellm',
    providerModelId: id.includes('/') ? id.slice(id.indexOf('/') + 1) : id,
    context: {
      contextWindow: nullableNumber(model.max_input_tokens ?? model.max_tokens),
      maxInputTokens: nullableNumber(model.max_input_tokens),
      maxOutputTokens: nullableNumber(model.max_output_tokens),
    },
    modalities: {
      input: { text: true, image: model.supports_vision ?? null, audio: model.supports_audio_input ?? null, video: null, files: model.supports_pdf_input ?? null },
      output: { text: true, image: model.supports_image_generation ?? null, audio: model.supports_audio_output ?? null, video: null },
    },
    capabilities: {
      toolCalling: model.supports_function_calling ?? null,
      structuredOutput: model.supports_response_schema ?? null,
      reasoning: model.supports_reasoning ?? null,
      streaming: model.supports_streaming ?? null,
      promptCaching: model.supports_prompt_caching ?? null,
      embeddings: model.mode === 'embedding' ? true : null,
    },
    toolCalling: {
      supported: model.supports_function_calling ?? null,
      parallel: model.supports_parallel_function_calling ?? null,
      strictSchema: model.supports_response_schema ?? null,
    },
    reasoning: { supported: model.supports_reasoning ?? null },
    pricing: {
      inputPerMillion: perTokenToMillion(model.input_cost_per_token),
      outputPerMillion: perTokenToMillion(model.output_cost_per_token),
      cachedInputPerMillion: perTokenToMillion(model.cache_read_input_token_cost),
      cacheWritePerMillion: perTokenToMillion(model.cache_creation_input_token_cost),
    },
    source: source('litellm-model-cost-map', model.litellm_provider ?? null, observedAt),
  }));
}

export function normalizePortkeyCatalog(payload, { observedAt = null } = {}) {
  const providers = Array.isArray(payload?.providers)
    ? payload.providers
    : Object.entries(payload?.providers ?? payload ?? {}).map(([id, value]) => ({ id, ...(value ?? {}) }));
  const records = [];
  for (const provider of providers) {
    const providerId = provider?.id ?? provider?.name;
    if (!providerId) continue;
    const models = Array.isArray(provider.models) ? provider.models : Object.entries(provider.models ?? {}).map(([id, value]) => ({ id, ...(value ?? {}) }));
    for (const model of models) {
      if (!model?.id) continue;
      records.push({
        id: String(model.base_model ?? `${providerId}/${model.id}`).toLowerCase(),
        baseModelId: model.base_model ?? null,
        providerFamily: String(providerId).toLowerCase(),
        providerModelId: String(model.id),
        context: {
          contextWindow: nullableNumber(model.context_window ?? model.max_context_length),
          maxInputTokens: nullableNumber(model.max_input_tokens),
          maxOutputTokens: nullableNumber(model.max_output_tokens),
        },
        capabilities: {
          toolCalling: model.supports_tools ?? null,
          structuredOutput: model.supports_structured_output ?? null,
          reasoning: model.supports_reasoning ?? null,
          streaming: model.supports_streaming ?? null,
        },
        toolCalling: { supported: model.supports_tools ?? null, parallel: model.supports_parallel_tools ?? null, strictSchema: model.supports_structured_output ?? null },
        reasoning: { supported: model.supports_reasoning ?? null },
        pricing: {
          inputPerMillion: nullableNumber(model.input_cost_per_million ?? model.pricing?.input),
          outputPerMillion: nullableNumber(model.output_cost_per_million ?? model.pricing?.output),
          cachedInputPerMillion: nullableNumber(model.cached_input_cost_per_million ?? model.pricing?.cached_input),
        },
        source: source('portkey-model-catalog', providerId, observedAt),
      });
    }
  }
  return records;
}
