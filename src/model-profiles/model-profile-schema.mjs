import { createHash } from 'node:crypto';

export function deepClone(value) {
  return value == null ? value : structuredClone(value);
}

export function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

export function stableSortObject(value) {
  if (Array.isArray(value)) return value.map(stableSortObject);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableSortObject(value[key])]));
}

export function canonicalJson(value) {
  return JSON.stringify(stableSortObject(value));
}

export function sha256Receipt(value) {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

export function mergeDefined(base, override) {
  if (override === undefined) return deepClone(base);
  if (Array.isArray(override)) return deepClone(override);
  if (!override || typeof override !== 'object') return override;
  const output = (base && typeof base === 'object' && !Array.isArray(base)) ? deepClone(base) : {};
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    output[key] = value && typeof value === 'object' && !Array.isArray(value)
      ? mergeDefined(output[key], value)
      : deepClone(value);
  }
  return output;
}

export function nullishProfileSkeleton() {
  return {
    schemaVersion: '1.0.0',
    canonicalId: null,
    aliases: [],
    providerFamily: null,
    providerModelId: null,
    identity: {
      publisher: null, family: null, series: null, version: null,
      displayName: null, releaseDate: null, knowledgeCutoff: null,
      license: null, openWeights: null,
    },
    lifecycle: { status: 'unknown', deprecatedAt: null, retirementAt: null, replacement: null },
    architecture: {
      type: null, totalParameters: null, activeParameters: null, parameterScale: null,
      tokenizerId: null, format: null, quantization: null, runtime: null,
    },
    context: {
      contextWindow: null, maxInputTokens: null, maxOutputTokens: null,
      maxImages: null, maxFiles: null, supportsCompaction: null,
    },
    modalities: {
      input: { text: true, image: null, audio: null, video: null, files: null },
      output: { text: true, image: null, audio: null, video: null },
    },
    capabilities: {
      coding: null, reasoning: null, agentic: null, toolCalling: null,
      structuredOutput: null, streaming: null, promptCaching: null,
      batch: null, citations: null, computerUse: null, embeddings: null,
      fineTuning: null, fillInMiddle: null, vision: null,
    },
    toolCalling: {
      supported: null, parallel: null, strictSchema: null, toolChoice: null,
      preservesReasoningContent: null, maxTools: null,
    },
    reasoning: { supported: null, levels: [], defaultLevel: null, controllable: null, visibleTrace: null },
    quality: {
      coding: null, reasoning: null, debugging: null, largeRefactor: null,
      frontend: null, toolUse: null, instructionFollowing: null, longContext: null,
    },
    specialties: [],
    taskEnvelope: {
      minimumClass: null, maximumClass: null, recommendedClasses: [],
      verificationRequired: true, autonomousChangeRisk: 'unknown',
    },
    pricing: {
      currency: 'USD', inputPerMillion: null, outputPerMillion: null,
      cachedInputPerMillion: null, cacheWritePerMillion: null,
    },
    limits: { rpm: null, tpm: null, maxConcurrency: null },
    deployment: { local: null, remote: null, selfHostable: null, endpointType: null },
    localRequirements: {
      estimatedRamGB: null, estimatedVramGB: null, estimateBasis: null,
      minimumRamGB: null, recommendedRamGB: null,
    },
    harnessRecommendations: {
      contextStrategy: null, toolStrategy: null, patchStrategy: null,
      retryStrategy: null, preferredHarnesses: [],
    },
    warnings: [],
    provenance: {
      sources: [], observedAt: null, verifiedAt: null,
      confidence: { overall: 0, identity: 0, capabilities: 0, limits: 0, pricing: 0 },
    },
    resolution: { kind: 'unknown', matchedBy: null },
  };
}

export function normalizeModelProfile(input, { freeze = true } = {}) {
  const profile = mergeDefined(nullishProfileSkeleton(), input ?? {});
  if (!profile.canonicalId || typeof profile.canonicalId !== 'string') {
    throw new TypeError('Model profile canonicalId must be a non-empty string');
  }
  profile.canonicalId = profile.canonicalId.trim().toLowerCase();
  profile.aliases = [...new Set((profile.aliases ?? []).filter(Boolean).map((x) => String(x).trim().toLowerCase()))]
    .filter((x) => x !== profile.canonicalId).sort();
  profile.specialties = [...new Set(profile.specialties ?? [])].sort();
  profile.reasoning.levels = [...new Set(profile.reasoning.levels ?? [])];
  profile.warnings = [...(profile.warnings ?? [])].map((warning) => ({ ...warning }));
  profile.provenance.sources = [...(profile.provenance.sources ?? [])].map((source) => ({ ...source }));
  const withoutReceipt = deepClone(profile);
  delete withoutReceipt.receiptSha256;
  profile.receiptSha256 = sha256Receipt(withoutReceipt);
  return freeze ? deepFreeze(profile) : profile;
}
