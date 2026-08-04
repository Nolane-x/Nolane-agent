import { deepClone, deepFreeze, sha256Receipt } from './model-profile-schema.mjs';
import { legacyProfileToTruthBundle, validateTruthBundle } from './model-truth-schema.mjs';

const FACT_PATHS = Object.freeze([
  'context.contextWindow', 'context.maxInputTokens', 'context.maxOutputTokens',
  'toolCalling.supported', 'toolCalling.parallel', 'toolCalling.strictSchema',
  'capabilities.structuredOutput', 'capabilities.streaming', 'capabilities.toolCalling',
  'pricing.inputPerMillion', 'pricing.outputPerMillion', 'pricing.cachedInputPerMillion',
  'limits.rpm', 'limits.tpm', 'limits.maxConcurrency',
  'deployment.local', 'deployment.remote', 'deployment.selfHostable',
  'architecture.format', 'architecture.quantization', 'architecture.runtime',
  'localRequirements.estimatedRamGB', 'localRequirements.estimatedVramGB', 'localRequirements.artifactSizeBytes',
  'lifecycle.status', 'lifecycle.deprecatedAt', 'lifecycle.retirementAt',
]);

function at(root, path) { return String(path).split('.').reduce((value, key) => value?.[key], root); }

function sourceConfidence(sourceType) {
  if (['official-provider-api', 'provider-api'].includes(sourceType)) return 0.95;
  if (sourceType === 'official-provider-doc') return 0.92;
  if (sourceType === 'nolane-evaluation') return 0.9;
  if (sourceType === 'trusted-catalog-import') return 0.82;
  if (sourceType === 'local-runtime') return 0.8;
  if (sourceType === 'identity-inference') return 0.5;
  return 0.6;
}

export class ModelTruthPlane {
  constructor({ registry, store, clock = () => new Date().toISOString() } = {}) {
    if (!registry?.resolve || !registry?.exportCatalog) throw new TypeError('Canonical model profile registry is required');
    if (!store?.recordFact || !store?.summary) throw new TypeError('Model truth store is required');
    this.registry = registry; this.store = store; this.clock = clock;
  }

  entities(modelId) {
    const profile = this.registry.resolve(modelId);
    const bundle = legacyProfileToTruthBundle(profile, { generatedAt: this.clock() });
    validateTruthBundle(bundle);
    const facts = this.store.factsFor(profile.canonicalId);
    const evaluations = this.store.evaluationsFor(profile.canonicalId);
    const observations = this.store.observationsFor(profile.canonicalId);
    const base = { schema: 'nolane.model-truth-view.v1', profile, bundle, facts, evaluations, runtimeObservations: observations.slice(-256) };
    return deepFreeze({ ...base, receiptSha256: sha256Receipt(base) });
  }

  summaryFor(modelId) {
    const profile = this.registry.resolve(modelId);
    const facts = this.store.factsFor(profile.canonicalId);
    const evaluations = this.store.evaluationsFor(profile.canonicalId);
    const observations = this.store.observationsFor(profile.canonicalId);
    const base = { schema: 'nolane.model-truth-card.v1', canonicalId: profile.canonicalId, resolution: profile.resolution?.kind ?? 'unknown', profileReceiptSha256: profile.receiptSha256, facts: facts.summary, evaluations: evaluations.length, runtimeObservations: observations.length, lastEvaluationAt: evaluations.at(-1)?.evaluatedAt ?? null, lastObservedAt: observations.at(-1)?.observedAt ?? profile.provenance?.observedAt ?? null };
    return deepFreeze({ ...base, receiptSha256: sha256Receipt(base) });
  }

  ingestDiscovery(record, { register = true, providerFamily = null, scope = {}, sourceId = null, adapterVersion = null } = {}) {
    const normalized = register ? this.registry.registerDiscovered(record) : deepClone(record);
    const canonicalId = this.registry.resolve({ id: normalized.id ?? record.id, providerFamily: providerFamily ?? normalized.providerFamily }).canonicalId;
    const sourceType = String(normalized.source?.type ?? 'nolane-provider-discovery').toLowerCase();
    const observedAt = normalized.source?.observedAt ?? normalized.observedAt ?? this.clock();
    for (const path of FACT_PATHS) {
      const value = at(normalized, path);
      if (value === undefined || value === null) continue;
      this.store.recordFact({ modelId: canonicalId, path, value, sourceType, sourceId: normalized.source?.providerId ?? sourceId ?? providerFamily, observedAt, verifiedAt: ['official-provider-api', 'provider-api', 'local-runtime'].includes(sourceType) ? observedAt : null, confidence: sourceConfidence(sourceType), scope: { provider: providerFamily ?? normalized.providerFamily ?? null, ...scope } });
    }
    return { canonicalId, normalized };
  }

  recordDiscoveryBatch({ providerFamily, models = [], observedAt = this.clock(), sourceId = null, adapterVersion = null, scope = {}, errors = [], register = false } = {}) {
    const ingested = models.map((record) => this.ingestDiscovery(record, { register, providerFamily, scope, sourceId, adapterVersion }));
    const discovery = this.store.recordDiscovery({ providerFamily, models: ingested.map((item) => item.normalized), observedAt, sourceId, adapterVersion, scope, errors });
    const base = { schema: 'nolane.model-discovery-ingestion.v1', providerFamily, discovery, models: ingested.map((item) => item.canonicalId) };
    return deepFreeze({ ...base, receiptSha256: sha256Receipt(base) });
  }

  recordFact(input) { return this.store.recordFact(input); }
  recordEvaluation(input) { return this.store.recordEvaluation(input); }
  recordRuntimeObservation(modelId, observation) { return this.store.recordRuntimeObservation(modelId, observation); }
  runtimeObservations() { return this.store.export().runtimeObservations; }
  facts(modelId, options = {}) { return this.store.factsFor(this.registry.resolve(modelId).canonicalId, options); }

  snapshot() {
    const catalog = this.registry.exportCatalog();
    const truth = this.store.summary();
    const base = { schema: 'nolane.model-truth-plane.v1', generatedAt: this.clock(), canonicalCatalog: { schemaVersion: catalog.schemaVersion, profiles: catalog.profiles.length, discoveryRecords: catalog.discoveryRecords.length, receiptSha256: catalog.receiptSha256 }, truth };
    return deepFreeze({ ...base, receiptSha256: sha256Receipt(base) });
  }

  compare(modelIds = [], { request = {}, evaluator = null } = {}) {
    const unique = [...new Set(modelIds.map(String))].slice(0, 5);
    if (unique.length < 2) throw new TypeError('At least two model IDs are required');
    const rows = unique.map((id) => {
      const profile = this.registry.resolve(id); const facts = this.store.factsFor(profile.canonicalId); const evaluations = this.store.evaluationsFor(profile.canonicalId); const observations = this.store.observationsFor(profile.canonicalId);
      return { modelId: profile.canonicalId, providerFamily: profile.providerFamily, deployment: profile.deployment, context: profile.context, toolCalling: profile.toolCalling, structuredOutput: profile.capabilities?.structuredOutput ?? null, quality: profile.quality, pricing: profile.pricing, localRequirements: profile.localRequirements, lifecycle: profile.lifecycle, confidence: profile.provenance?.confidence ?? {}, freshness: facts.summary, evaluations: evaluations.length, runtimeObservations: observations.length, evaluation: evaluator ? evaluator(profile, request) : null, profileReceiptSha256: profile.receiptSha256, factsReceiptSha256: facts.receiptSha256 };
    });
    const base = { schema: 'nolane.model-comparison.v1', generatedAt: this.clock(), request, rows };
    return deepFreeze({ ...base, receiptSha256: sha256Receipt(base) });
  }
}
