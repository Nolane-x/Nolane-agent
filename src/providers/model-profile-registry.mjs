import { createBuiltInModelProfiles, ModelProfileRegistry as IntelligenceModelProfileRegistry } from '../model-profiles/index.mjs';
import { advancedProfileToLegacyPatch, canonicalModelId, legacyDiscoveryToAdvancedRecord } from '../model-management/model-profile-adapter.mjs';

const CAPABILITIES = ['text','vision','audio','video','tools','parallelTools','structuredOutput','streaming','reasoning','computerUse','embeddings','imageGeneration'];
const SENSITIVE = /(api[-_]?key|access[-_]?token|refresh[-_]?token|password|secret|credential|authorization)/i;
const unknownCapabilities = () => Object.fromEntries(CAPABILITIES.map((key) => [key, 'unknown']));
const clone = (value) => structuredClone(value ?? {});
const freeze = (value) => Object.freeze(Array.isArray(value) ? value.map(freeze) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, child]) => [key, freeze(child)])) : value);
const REASONING_LEVEL = /^[a-z0-9][a-z0-9._-]{0,63}$/;
function cleanObject(value) {
  if (Array.isArray(value)) return value.map(cleanObject);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !SENSITIVE.test(key)).map(([key, child]) => [key, cleanObject(child)]));
}
function normalizeKey(providerId, modelId) { return `${String(providerId).trim()}/${String(modelId).trim()}`; }
function normalizeReasoningLevels(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item ?? '').trim().toLowerCase()).filter((item) => REASONING_LEVEL.test(item)))];
}
function mergeReasoning(current, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return current;
  const levels = normalizeReasoningLevels(input.levels);
  const hasEvidence = input.supported === true || input.supported === false || input.controllable === true || input.controllable === false || levels.length > 0 || input.defaultLevel != null;
  if (!hasEvidence) return current;
  const nextLevels = Array.isArray(input.levels) ? levels : current.levels;
  const candidateDefault = input.defaultLevel == null ? current.defaultLevel : String(input.defaultLevel).trim().toLowerCase();
  return {
    supported: input.supported === true ? true : input.supported === false ? false : current.supported,
    controllable: input.controllable === true ? true : input.controllable === false ? false : current.controllable,
    levels: nextLevels,
    defaultLevel: nextLevels.includes(candidateDefault) ? candidateDefault : null,
  };
}
function baseProfile(providerId, modelId) {
  return { key: normalizeKey(providerId, modelId), providerId: String(providerId), modelId: String(modelId), displayName: String(modelId), family: null, tokenizerId: null, aliases: [], lifecycle: 'unknown', context: { inputTokens: null, outputTokens: null }, modalities: { input: ['text'], output: ['text'] }, capabilities: unknownCapabilities(), reasoning: { supported: 'unknown', controllable: 'unknown', levels: [], defaultLevel: null }, pricing: {}, quotas: {}, local: {}, metadata: {}, intelligence: null, declared: {}, discovered: {}, probed: {}, observed: {}, userOverrides: {}, sources: [] };
}
function mergeProfile(current, patch, source) {
  const next = clone(current);
  const input = cleanObject(patch);
  if (input.displayName) next.displayName = String(input.displayName);
  if (input.family != null) next.family = String(input.family);
  if (input.tokenizerId != null) next.tokenizerId = String(input.tokenizerId);
  if (input.aliases) next.aliases = [...new Set([...next.aliases, ...input.aliases.map(String)])].sort();
  if (input.lifecycle) next.lifecycle = String(input.lifecycle);
  if (input.contextLength != null) next.context.inputTokens = Number(input.contextLength) || null;
  if (input.context) next.context = { ...next.context, ...input.context };
  if (input.inputModalities || input.outputModalities || input.modalities) next.modalities = { input: input.inputModalities ?? input.modalities?.input ?? next.modalities.input, output: input.outputModalities ?? input.modalities?.output ?? next.modalities.output };
  if (Array.isArray(next.modalities.input) && next.modalities.input.includes('image')) next.capabilities.vision = true;
  if (input.capabilities) next.capabilities = { ...next.capabilities, ...input.capabilities };
  if (input.reasoning) next.reasoning = mergeReasoning(next.reasoning, input.reasoning);
  for (const key of ['pricing','quotas','local','metadata']) if (input[key]) next[key] = { ...next[key], ...input[key] };
  if (input.intelligence) next.intelligence = input.intelligence;
  if (input.sourceUrl || input.reviewedAt) next.sources = [...next.sources, { kind: source, url: input.sourceUrl ?? null, reviewedAt: input.reviewedAt ?? null }].slice(-20);
  if (source !== 'intelligence') next[source] = { ...next[source], ...input };
  else if (input.intelligence) next.intelligence = input.intelligence;
  return next;
}

export class ModelProfileRegistry {
  constructor({ seeds = [], families = [], intelligenceRegistry = null, truthPlane = null } = {}) {
    this.records = new Map();
    this.truthPlane = truthPlane;
    this.families = Object.freeze(families.map((item) => freeze(cleanObject(item))));
    this.intelligenceRegistry = intelligenceRegistry ?? new IntelligenceModelProfileRegistry({ profiles: createBuiltInModelProfiles() });
    for (const seed of seeds) this.upsert(seed, { source: 'declared' });
  }
  #family(providerId, modelId) {
    return this.families.find((item) => item.providerId === providerId && new RegExp(item.pattern, item.flags ?? 'i').test(modelId)) ?? null;
  }
  #intelligence(providerId, modelId, profile = {}) {
    const canonicalId = canonicalModelId(providerId, modelId);
    const hasOperationalDiscovery = ['contextLength', 'outputTokenLimit', 'context', 'capabilities', 'reasoning', 'inputModalities', 'outputModalities', 'modalities', 'local', 'kind', 'discoveredAt']
      .some((key) => profile?.[key] !== undefined && profile?.[key] !== null);
    try {
      if (hasOperationalDiscovery) this.intelligenceRegistry.registerDiscovered(legacyDiscoveryToAdvancedRecord({ providerId, modelId, ...profile }, { providerId }));
    } catch {
      // A malformed operational observation must not make the compatibility registry unavailable.
    }
    const deployment = {
      local: profile?.local?.enabled,
      runtime: profile?.local?.runtime,
      format: profile?.local?.format,
      quantization: profile?.local?.quantization,
    };
    return this.intelligenceRegistry.resolve({ id: canonicalId, providerFamily: providerId, deployment });
  }
  upsert(profile, { source = 'declared' } = {}) {
    const providerId = String(profile?.providerId ?? '').trim(); const modelId = String(profile?.modelId ?? profile?.id ?? '').trim();
    if (!providerId || !modelId) throw new TypeError('providerId and modelId are required');
    const key = normalizeKey(providerId, modelId); let current = this.records.get(key) ?? baseProfile(providerId, modelId);
    if (!this.records.has(key)) {
      const family = this.#family(providerId, modelId);
      if (family) current = mergeProfile(current, { ...family, family: family.id }, 'declared');
    }
    const advanced = this.#intelligence(providerId, modelId, profile);
    let next = mergeProfile(current, profile, source);
    next = mergeProfile(next, advancedProfileToLegacyPatch(advanced, { providerId, modelId }), 'intelligence');
    this.records.set(key, next); return this.get(key);
  }
  attachTruthPlane(truthPlane) { this.truthPlane = truthPlane; return this; }
  mergeDiscovery(providerId, models = []) {
    const profiles = models.map((model) => this.upsert({ providerId, modelId: model.id ?? model.modelId, ...model }, { source: 'discovered' }));
    this.truthPlane?.recordDiscoveryBatch?.({ providerFamily: providerId, models: models.map((model) => legacyDiscoveryToAdvancedRecord({ providerId, modelId: model.id ?? model.modelId, ...model }, { providerId })), observedAt: models.find((model) => model?.discoveredAt)?.discoveredAt ?? new Date().toISOString(), sourceId: providerId, register: false });
    return profiles;
  }
  recordProbe(key, result = {}) {
    const current = this.#required(key);
    const patch = { capabilities: result.capabilities ?? {}, metadata: { lastProbeAt: result.testedAt ?? null, lastProbeDurationMs: result.durationMs ?? null, probeErrors: result.errors ?? [] } };
    let next = mergeProfile(current, patch, 'probed');
    const advancedRecord = legacyDiscoveryToAdvancedRecord({ providerId: current.providerId, modelId: current.modelId, capabilities: {
      toolCalling: result.capabilities?.tools,
      structuredOutput: result.capabilities?.structuredOutput,
      streaming: result.capabilities?.streaming,
    }, discoveredAt: result.testedAt }, { providerId: current.providerId });
    advancedRecord.toolCalling = { supported: result.capabilities?.tools ?? null };
    advancedRecord.capabilities = { structuredOutput: result.capabilities?.structuredOutput ?? null, streaming: result.capabilities?.streaming ?? null };
    this.intelligenceRegistry.registerDiscovered(advancedRecord);
    this.truthPlane?.recordDiscoveryBatch?.({ providerFamily: current.providerId, models: [advancedRecord], observedAt: result.testedAt ?? new Date().toISOString(), sourceId: `${current.providerId}:probe`, register: false });
    this.truthPlane?.recordEvaluation?.({ modelId: advancedRecord.id, suiteId: 'nolane.capability-probe', suiteVersion: '1', evaluatedAt: result.testedAt ?? new Date().toISOString(), harnessVersion: 'provider-capability-probe', passed: !(result.errors ?? []).length, metrics: { capabilities: result.capabilities ?? {}, durationMs: result.durationMs ?? null, errors: result.errors ?? [] }, scope: { provider: current.providerId } });
    const advanced = this.#intelligence(current.providerId, current.modelId, next);
    next = mergeProfile(next, advancedProfileToLegacyPatch(advanced, { providerId: current.providerId, modelId: current.modelId }), 'intelligence');
    this.records.set(current.key, next); return this.get(current.key);
  }
  recordObservation(key, observed = {}) { const current = this.#required(key); const next = clone(current); next.observed = { ...next.observed, ...cleanObject(observed) }; this.records.set(current.key, next); return this.get(current.key); }
  #required(key) { const record = this.records.get(String(key)); if (!record) throw new Error(`Unknown model profile: ${key}`); return record; }
  get(key) { return freeze(cleanObject(this.#required(key))); }
  resolveIntelligence(providerId, modelId, deployment = {}) { return this.intelligenceRegistry.resolve({ id: canonicalModelId(providerId, modelId), providerFamily: providerId, deployment }); }
  list({ providerId = null, query = '' } = {}) { const needle = String(query).toLowerCase(); return [...this.records.values()].filter((item) => !providerId || item.providerId === providerId).filter((item) => !needle || `${item.displayName} ${item.modelId} ${item.family ?? ''} ${item.aliases.join(' ')}`.toLowerCase().includes(needle)).sort((a,b) => a.providerId.localeCompare(b.providerId) || a.displayName.localeCompare(b.displayName)).map((item) => freeze(cleanObject(item))); }
  publicView(options = {}) {
    const models = this.list(options).map((model) => {
      const canonicalId = model.metadata?.canonicalId ?? canonicalModelId(model.providerId, model.modelId);
      const truth = this.truthPlane?.summaryFor?.(canonicalId) ?? null;
      return freeze({ ...model, truth });
    });
    const catalog = this.intelligenceRegistry.exportCatalog();
    const truth = this.truthPlane?.snapshot?.() ?? null;
    return freeze({ schema: 'nolane.model-profiles.v2', compatibilitySchema: 'nolane.model-profiles.v1', canonicalTruthSchema: truth?.schema ?? null, families: this.families, models, intelligence: { exactProfiles: catalog.profiles.length, familyAndSizeTemplates: catalog.families.length, discoveryRecords: catalog.discoveryRecords.length, catalogReceiptSha256: catalog.receiptSha256, truth }, summary: { models: models.length, providers: new Set(models.map((item) => item.providerId)).size, probed: models.filter((item) => item.metadata.lastProbeAt).length } });
  }
}
