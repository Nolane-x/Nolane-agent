import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { canonicalJson, deepClone, deepFreeze, sha256Receipt } from './model-profile-schema.mjs';
import { MODEL_TRUTH_SCHEMAS } from './model-truth-schema.mjs';

const STORE_SCHEMA = 'nolane.model-truth-store.v1';
const SECRET = /(?:api[-_]?key|access[-_]?token|refresh[-_]?token|password|secret|credential|authorization)/i;
const SOURCE_WEIGHT = Object.freeze({
  'official-provider-api': 700,
  'provider-api': 680,
  'official-provider-doc': 650,
  'nolane-evaluation': 600,
  'runtime-observation': 520,
  'trusted-catalog-import': 450,
  'catalog-import': 420,
  'local-runtime': 400,
  'nolane-provider-discovery': 380,
  'identity-inference': 220,
  provisional: 100,
  unknown: 0,
});
const TTL = Object.freeze({
  health: 60 * 60 * 1000,
  availability: 6 * 60 * 60 * 1000,
  limits: 7 * 24 * 60 * 60 * 1000,
  pricing: 7 * 24 * 60 * 60 * 1000,
  context: 14 * 24 * 60 * 60 * 1000,
  lifecycle: 7 * 24 * 60 * 60 * 1000,
  tool: 90 * 24 * 60 * 60 * 1000,
  policy: 30 * 24 * 60 * 60 * 1000,
  architecture: 180 * 24 * 60 * 60 * 1000,
  default: 30 * 24 * 60 * 60 * 1000,
});

function sanitize(value, depth = 0) {
  if (depth > 12) return '[TRUNCATED]';
  if (Array.isArray(value)) return value.slice(0, 512).map((item) => sanitize(item, depth + 1));
  if (!value || typeof value !== 'object') return typeof value === 'string' ? value.slice(0, 20_000) : value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !SECRET.test(key)).slice(0, 512).map(([key, child]) => [key, sanitize(child, depth + 1)]));
}

function emptyState() {
  return { schema: STORE_SCHEMA, version: 1, facts: [], discoveries: [], evaluations: [], runtimeObservations: [], aliasHistory: [] };
}

function atomicWrite(file, value) {
  mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, file);
}

function parseTime(value) {
  const time = Date.parse(String(value ?? ''));
  return Number.isFinite(time) ? time : null;
}

function category(pathname) {
  const value = String(pathname ?? '');
  if (/health|latency|availability|error/i.test(value)) return 'health';
  if (/available|region|accountTier/i.test(value)) return 'availability';
  if (/pricing|economics|cost/i.test(value)) return 'pricing';
  if (/limits|rpm|tpm|concurr/i.test(value)) return 'limits';
  if (/context|maxInput|maxOutput|tokens/i.test(value)) return 'context';
  if (/lifecycle|deprecated|retirement/i.test(value)) return 'lifecycle';
  if (/tool|structuredOutput|conformance/i.test(value)) return 'tool';
  if (/policy|license|retention|residency|sensitive/i.test(value)) return 'policy';
  if (/architecture|tokenizer|parameter|format|quantization/i.test(value)) return 'architecture';
  return 'default';
}

function scopeSpecificity(scope = {}) {
  return Object.values(scope ?? {}).filter((value) => value !== null && value !== undefined && value !== '').length;
}

function comparable(value) { return canonicalJson(value); }

function normalizedFact(input, clock) {
  const modelId = String(input?.modelId ?? '').trim().toLowerCase();
  const pathName = String(input?.path ?? '').trim();
  if (!modelId || !pathName) throw new TypeError('modelId and path are required');
  const sourceType = String(input?.sourceType ?? 'unknown').trim().toLowerCase();
  const observedAt = String(input?.observedAt ?? clock());
  const base = {
    schema: 'nolane.model-fact.v1',
    factId: String(input?.factId ?? `fact-${randomUUID()}`),
    modelId,
    path: pathName,
    value: sanitize(input?.value),
    sourceType,
    sourceId: input?.sourceId == null ? null : String(input.sourceId).slice(0, 1000),
    observedAt,
    verifiedAt: input?.verifiedAt == null ? null : String(input.verifiedAt),
    expiresAt: input?.expiresAt == null ? null : String(input.expiresAt),
    confidence: Math.max(0, Math.min(1, Number(input?.confidence ?? 0))),
    scope: sanitize(input?.scope ?? {}),
  };
  return { ...base, receiptSha256: sha256Receipt(base) };
}

function freshness(fact, now) {
  if (!fact) return 'unknown';
  const expiresAt = parseTime(fact.expiresAt);
  if (expiresAt != null && now >= expiresAt) return 'expired';
  const observed = parseTime(fact.observedAt);
  if (observed == null) return 'stale';
  const ttl = TTL[category(fact.path)] ?? TTL.default;
  const age = Math.max(0, now - observed);
  if (age > ttl * 2) return 'expired';
  if (age > ttl) return 'stale';
  return 'fresh';
}

function rank(fact) {
  return [SOURCE_WEIGHT[fact.sourceType] ?? 0, scopeSpecificity(fact.scope), fact.verifiedAt ? 1 : 0, parseTime(fact.observedAt) ?? 0, fact.confidence];
}

function compareRank(a, b) {
  const left = rank(a); const right = rank(b);
  for (let i = 0; i < left.length; i += 1) if (left[i] !== right[i]) return right[i] - left[i];
  return a.factId.localeCompare(b.factId);
}

export class ModelTruthStore {
  constructor({ file = null, clock = () => new Date().toISOString(), now = () => Date.now(), maxFacts = 20_000, maxDiscoveries = 2_000, maxEvaluations = 5_000, maxRuntimeObservations = 20_000 } = {}) {
    this.file = file ? path.resolve(file) : null;
    this.clock = clock;
    this.now = now;
    this.limits = { maxFacts, maxDiscoveries, maxEvaluations, maxRuntimeObservations };
    this.state = emptyState();
    if (this.file) this.#load();
  }

  #load() {
    try {
      const parsed = JSON.parse(readFileSync(this.file, 'utf8'));
      if (parsed?.schema !== STORE_SCHEMA || Number(parsed.version) !== 1) throw new TypeError('Unsupported model truth store');
      this.state = { ...emptyState(), ...sanitize(parsed) };
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        const corrupt = `${this.file}.corrupt-${Date.now()}`;
        try { renameSync(this.file, corrupt); } catch {}
      }
      this.state = emptyState();
    }
  }

  #persist() { if (this.file) atomicWrite(this.file, this.state); }
  #trim(key, limit) { if (this.state[key].length > limit) this.state[key].splice(0, this.state[key].length - limit); }

  recordFact(input) {
    const fact = normalizedFact(input, this.clock);
    const duplicate = this.state.facts.find((item) => item.modelId === fact.modelId && item.path === fact.path && item.sourceType === fact.sourceType && item.sourceId === fact.sourceId && comparable(item.scope) === comparable(fact.scope) && comparable(item.value) === comparable(fact.value));
    if (duplicate) return deepFreeze(deepClone(duplicate));
    this.state.facts.push(fact); this.#trim('facts', this.limits.maxFacts); this.#persist();
    return deepFreeze(deepClone(fact));
  }

  resolveFact(modelId, pathName) {
    const id = String(modelId ?? '').trim().toLowerCase();
    const candidates = this.state.facts.filter((item) => item.modelId === id && item.path === String(pathName)).sort(compareRank);
    if (!candidates.length) return deepFreeze({ schema: 'nolane.model-fact-resolution.v1', modelId: id, path: String(pathName), status: 'unknown', selected: null, candidates: [], conflicts: [], receiptSha256: sha256Receipt({ modelId: id, path: String(pathName), status: 'unknown' }) });
    const selected = candidates[0];
    const selectedRank = rank(selected);
    const conflicts = candidates.slice(1).filter((item) => {
      const other = rank(item);
      return selectedRank[0] - other[0] <= 50 && selectedRank[1] === other[1] && comparable(selected.value) !== comparable(item.value);
    });
    const status = conflicts.length ? 'conflicted' : freshness(selected, this.now());
    const base = { schema: 'nolane.model-fact-resolution.v1', modelId: id, path: String(pathName), status, selected, candidates, conflicts };
    return deepFreeze({ ...deepClone(base), receiptSha256: sha256Receipt(base) });
  }

  factsFor(modelId, { pathPrefix = '' } = {}) {
    const id = String(modelId ?? '').trim().toLowerCase();
    const paths = [...new Set(this.state.facts.filter((item) => item.modelId === id && (!pathPrefix || item.path.startsWith(pathPrefix))).map((item) => item.path))].sort();
    const facts = paths.map((pathName) => this.resolveFact(id, pathName));
    const base = { schema: 'nolane.model-facts.v1', modelId: id, facts, summary: { total: facts.length, fresh: facts.filter((item) => item.status === 'fresh').length, stale: facts.filter((item) => item.status === 'stale').length, expired: facts.filter((item) => item.status === 'expired').length, conflicted: facts.filter((item) => item.status === 'conflicted').length, unknown: facts.filter((item) => item.status === 'unknown').length } };
    return deepFreeze({ ...base, receiptSha256: sha256Receipt(base) });
  }

  recordDiscovery({ providerFamily, models = [], observedAt = this.clock(), sourceId = null, adapterVersion = null, scope = {}, errors = [] } = {}) {
    const sanitizedModels = sanitize(models).map((model) => ({ id: model.id ?? model.modelId ?? null, providerModelId: model.providerModelId ?? model.modelId ?? null, receiptSha256: sha256Receipt(model) }));
    const previous = [...this.state.discoveries].reverse().find((item) => item.providerFamily === providerFamily && comparable(item.scope) === comparable(scope));
    const previousIds = new Set(previous?.models?.map((item) => item.id) ?? []); const currentIds = new Set(sanitizedModels.map((item) => item.id));
    const base = { schema: 'nolane.model-discovery-observation.v1', discoveryId: `discovery-${randomUUID()}`, providerFamily: String(providerFamily ?? 'unknown'), sourceId, adapterVersion, observedAt, scope: sanitize(scope), models: sanitizedModels, diff: { added: [...currentIds].filter((id) => !previousIds.has(id)).sort(), removed: [...previousIds].filter((id) => !currentIds.has(id)).sort() }, errors: sanitize(errors), responseSha256: createHash('sha256').update(canonicalJson(sanitize(models))).digest('hex') };
    const record = { ...base, receiptSha256: sha256Receipt(base) };
    this.state.discoveries.push(record); this.#trim('discoveries', this.limits.maxDiscoveries); this.#persist();
    return deepFreeze(deepClone(record));
  }

  recordEvaluation(input = {}) {
    const modelId = String(input.modelId ?? '').trim().toLowerCase();
    if (!modelId || !input.suiteId || !input.suiteVersion) throw new TypeError('modelId, suiteId, and suiteVersion are required');
    const base = {
      schema: MODEL_TRUTH_SCHEMAS.evaluation,
      evaluationId: String(input.evaluationId ?? `evaluation-${randomUUID()}`),
      modelId,
      baseModelId: input.baseModelId ?? null,
      snapshotId: input.snapshotId ?? null,
      deploymentId: input.deploymentId ?? null,
      localArtifactId: input.localArtifactId ?? null,
      evaluatedAt: String(input.evaluatedAt ?? this.clock()),
      suiteId: String(input.suiteId), suiteVersion: String(input.suiteVersion),
      harnessVersion: input.harnessVersion == null ? null : String(input.harnessVersion),
      toolProtocolVersion: input.toolProtocolVersion == null ? null : String(input.toolProtocolVersion),
      requestConfig: sanitize(input.requestConfig ?? {}), scope: sanitize(input.scope ?? {}),
      metrics: sanitize(input.metrics ?? {}), passed: input.passed === true,
      artifacts: sanitize(input.artifacts ?? []), scorerVersion: input.scorerVersion == null ? null : String(input.scorerVersion),
    };
    const record = { ...base, receiptSha256: sha256Receipt(base) };
    this.state.evaluations.push(record); this.#trim('evaluations', this.limits.maxEvaluations); this.#persist();
    return deepFreeze(deepClone(record));
  }

  recordRuntimeObservation(modelId, observation = {}) {
    const id = String(modelId ?? '').trim().toLowerCase(); if (!id) throw new TypeError('modelId is required');
    const base = { schema: MODEL_TRUTH_SCHEMAS.observation, observationId: `observation-${randomUUID()}`, modelId: id, observedAt: String(observation.at ?? this.clock()), success: observation.success === true, latencyMs: Number.isFinite(Number(observation.latencyMs)) ? Math.max(0, Number(observation.latencyMs)) : null, inputTokens: Number.isFinite(Number(observation.inputTokens)) ? Math.max(0, Number(observation.inputTokens)) : null, outputTokens: Number.isFinite(Number(observation.outputTokens)) ? Math.max(0, Number(observation.outputTokens)) : null, costUsd: Number.isFinite(Number(observation.costUsd)) ? Math.max(0, Number(observation.costUsd)) : null, toolSuccess: observation.toolSuccess == null ? null : observation.toolSuccess === true, structuredOutputValid: observation.structuredOutputValid == null ? null : observation.structuredOutputValid === true, errorCode: observation.success === true ? null : String(observation.errorCode ?? 'unknown-error').slice(0, 160), scope: sanitize(observation.scope ?? observation.metadata ?? {}) };
    const record = { ...base, receiptSha256: sha256Receipt(base) };
    this.state.runtimeObservations.push(record); this.#trim('runtimeObservations', this.limits.maxRuntimeObservations); this.#persist();
    return deepFreeze(deepClone(record));
  }

  evaluationsFor(modelId) { return deepFreeze(this.state.evaluations.filter((item) => item.modelId === String(modelId ?? '').toLowerCase()).map(deepClone)); }
  observationsFor(modelId) { return deepFreeze(this.state.runtimeObservations.filter((item) => item.modelId === String(modelId ?? '').toLowerCase()).map(deepClone)); }

  summary() {
    const ids = new Set([...this.state.facts.map((item) => item.modelId), ...this.state.evaluations.map((item) => item.modelId), ...this.state.runtimeObservations.map((item) => item.modelId)]);
    const factSummaries = [...ids].map((id) => this.factsFor(id).summary);
    const base = { schema: 'nolane.model-truth-summary.v1', facts: this.state.facts.length, discoveries: this.state.discoveries.length, evaluations: this.state.evaluations.length, runtimeObservations: this.state.runtimeObservations.length, models: ids.size, freshness: { fresh: factSummaries.reduce((n, item) => n + item.fresh, 0), stale: factSummaries.reduce((n, item) => n + item.stale, 0), expired: factSummaries.reduce((n, item) => n + item.expired, 0), conflicted: factSummaries.reduce((n, item) => n + item.conflicted, 0) } };
    return deepFreeze({ ...base, receiptSha256: sha256Receipt(base) });
  }

  export() {
    const base = { ...deepClone(this.state), generatedAt: this.clock(), summary: this.summary() };
    return deepFreeze({ ...base, receiptSha256: sha256Receipt(base) });
  }
}
