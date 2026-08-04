const PROVIDER_PUBLISHERS = Object.freeze({
  'openai-api': 'openai', openai: 'openai', codex: 'openai', 'codex-app-server': 'openai',
  'anthropic-api': 'anthropic', anthropic: 'anthropic', claude: 'anthropic',
  'gemini-api': 'google', google: 'google', gemini: 'google',
  'deepseek-api': 'deepseek', deepseek: 'deepseek',
  'mistral-api': 'mistralai', mistral: 'mistralai',
  'alibaba-api': 'qwen', qwen: 'qwen',
});

export function canonicalModelId(providerId, modelId) {
  const raw = String(modelId ?? '').trim().toLowerCase();
  if (!raw) throw new TypeError('modelId is required');
  if (raw.includes('/')) return raw;
  const publisher = PROVIDER_PUBLISHERS[String(providerId ?? '').trim().toLowerCase()];
  return publisher ? `${publisher}/${raw}` : `${String(providerId ?? 'unknown').trim().toLowerCase()}/${raw}`;
}

function tri(value) { return value === true ? true : value === false ? false : 'unknown'; }

export function advancedProfileToLegacyPatch(profile, { providerId, modelId } = {}) {
  return {
    providerId: String(providerId ?? profile.providerFamily ?? 'unknown'),
    modelId: String(modelId ?? profile.providerModelId ?? profile.canonicalId),
    displayName: profile.identity?.displayName ?? profile.providerModelId ?? profile.canonicalId,
    family: profile.identity?.family ?? null,
    tokenizerId: profile.architecture?.tokenizerId ?? null,
    aliases: profile.aliases ?? [],
    lifecycle: profile.lifecycle?.status ?? 'unknown',
    context: {
      inputTokens: profile.context?.maxInputTokens ?? profile.context?.contextWindow ?? null,
      outputTokens: profile.context?.maxOutputTokens ?? null,
    },
    modalities: {
      input: Object.entries(profile.modalities?.input ?? {}).filter(([, enabled]) => enabled === true).map(([name]) => name),
      output: Object.entries(profile.modalities?.output ?? {}).filter(([, enabled]) => enabled === true).map(([name]) => name),
    },
    capabilities: {
      text: true,
      vision: tri(profile.modalities?.input?.image ?? profile.capabilities?.vision),
      audio: tri(profile.modalities?.input?.audio),
      video: tri(profile.modalities?.input?.video),
      tools: tri(profile.toolCalling?.supported),
      parallelTools: tri(profile.toolCalling?.parallel),
      structuredOutput: tri(profile.capabilities?.structuredOutput),
      streaming: tri(profile.capabilities?.streaming),
      reasoning: tri(profile.reasoning?.supported ?? profile.capabilities?.reasoning),
      computerUse: tri(profile.capabilities?.computerUse),
      embeddings: tri(profile.capabilities?.embeddings),
      imageGeneration: tri(profile.modalities?.output?.image),
    },
    pricing: profile.pricing ?? {},
    quotas: profile.limits ?? {},
    local: {
      enabled: profile.deployment?.local ?? null,
      runtime: profile.architecture?.runtime ?? null,
      format: profile.architecture?.format ?? null,
      quantization: profile.architecture?.quantization ?? null,
      estimatedRamGB: profile.localRequirements?.estimatedRamGB ?? null,
      estimatedVramGB: profile.localRequirements?.estimatedVramGB ?? null,
    },
    metadata: {
      canonicalId: profile.canonicalId,
      profileReceiptSha256: profile.receiptSha256,
      resolution: profile.resolution,
      confidence: profile.provenance?.confidence ?? {},
      taskEnvelope: profile.taskEnvelope,
      quality: profile.quality,
      warnings: profile.warnings,
    },
    intelligence: profile,
  };
}

export function legacyDiscoveryToAdvancedRecord(record, { providerId = record?.providerId } = {}) {
  const id = canonicalModelId(providerId, record?.modelId ?? record?.id);
  const inputModalities = new Set(record?.inputModalities ?? record?.modalities?.input ?? []);
  const outputModalities = new Set(record?.outputModalities ?? record?.modalities?.output ?? []);
  return {
    id,
    providerModelId: String(record?.modelId ?? record?.id ?? '').trim(),
    providerFamily: String(providerId ?? 'unknown'),
    context: {
      contextWindow: Number(record?.contextLength ?? record?.context?.inputTokens) || null,
      maxInputTokens: Number(record?.contextLength ?? record?.context?.inputTokens) || null,
      maxOutputTokens: Number(record?.outputTokenLimit ?? record?.context?.outputTokens) || null,
    },
    modalities: {
      input: { text: inputModalities.has('text') || inputModalities.size === 0, image: inputModalities.has('image'), audio: inputModalities.has('audio'), video: inputModalities.has('video'), files: inputModalities.has('files') },
      output: { text: outputModalities.has('text') || outputModalities.size === 0, image: outputModalities.has('image'), audio: outputModalities.has('audio'), video: outputModalities.has('video') },
    },
    capabilities: record?.capabilities ?? {},
    toolCalling: { supported: record?.capabilities?.tools ?? null, parallel: record?.capabilities?.parallelTools ?? null },
    deployment: {
      local: ['ollama', 'lm-studio', 'openai-compatible'].includes(String(record?.kind ?? '').toLowerCase()) || Boolean(record?.local?.runtime || record?.local?.format || record?.local?.quantization),
      endpointType: record?.kind ?? null,
    },
    architecture: {
      quantization: record?.local?.quantization ?? null,
      format: record?.local?.format ?? null,
      runtime: record?.local?.runtime ?? null,
    },
    source: { type: 'nolane-provider-discovery', providerId: String(providerId ?? 'unknown'), observedAt: record?.discoveredAt ?? new Date().toISOString() },
  };
}
