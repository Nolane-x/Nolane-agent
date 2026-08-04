import { createHash } from 'node:crypto';
import { openAsBlob } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { canonicalSha256, deepFreeze, boundedNumber } from './shared.mjs';
import { serializeTypedModelState } from './model-state-serializer.mjs';

export class SpecialistModelFabric {
  #versions = new Map();
  #active = new Map();
  #resident = [];
  #receipts = [];
  #independentReceipts = new Map();
  #domainTrust = new Map();
  #schemas = new Map();
  #artifacts = new Map();
  #mapped = new Map();
  #mappingProvider;
  #max;

  constructor({ maxResidentGenerative = 1, mappingProvider = null } = {}) {
    this.#max = Math.max(1, Number(maxResidentGenerative));
    if (mappingProvider !== null && typeof mappingProvider?.mapReadOnly !== 'function') throw new TypeError('mappingProvider must expose mapReadOnly()');
    this.#mappingProvider = mappingProvider;
  }

  register(definition) {
    for (const key of ['id', 'version', 'kind', 'capabilities', 'domains', 'serializer']) {
      if (definition?.[key] === undefined) throw new TypeError(`Specialist requires ${key}`);
    }
    if (!['classifier', 'reranker', 'generative', 'reward', 'router'].includes(definition.kind)) throw new TypeError('Unsupported specialist kind');
    const model = deepFreeze({ memoryMb: 0, trust: 0, ...definition, capabilities: [...definition.capabilities], domains: [...definition.domains] });
    const history = this.#versions.get(model.id) ?? [];
    this.#versions.set(model.id, [...history, model]);
    this.#active.set(model.id, model);
    return model;
  }


  registerArtifact({ id, version, path: artifactPath, sha256, mapping = 'file-backed', memoryMb = 0 } = {}) {
    const model = this.#active.get(String(id));
    if (!model || model.version !== String(version)) throw new Error(`Unknown active specialist version: ${id}@${version}`);
    if (!artifactPath || !/^[a-f0-9]{64}$/i.test(String(sha256 ?? ''))) throw new TypeError('Artifact path and sha256 are required');
    if (!['file-backed', 'mmap-readonly'].includes(mapping)) throw new TypeError('Unsupported artifact mapping mode');
    if (mapping === 'mmap-readonly' && !this.#mappingProvider) throw new Error('Native mmap provider is not configured');
    const record = deepFreeze({
      schema: 'nolane.small-model.specialist-artifact.v1', id: String(id), version: String(version),
      path: path.resolve(String(artifactPath)), sha256: String(sha256).toLowerCase(), mapping, memoryMb: Math.max(0, Number(memoryMb) || 0),
    });
    this.#artifacts.set(record.id, record);
    return record;
  }

  async lazyLoad(id) {
    const key = String(id);
    const model = this.#active.get(key);
    const artifact = this.#artifacts.get(key);
    if (!model || !artifact) throw new Error(`Specialist artifact is not registered: ${key}`);
    if (this.#mapped.has(key)) return this.#mapped.get(key).view;
    const info = await stat(artifact.path);
    if (!info.isFile()) throw new Error(`Specialist artifact is not a file: ${artifact.path}`);
    const bytes = await readFile(artifact.path);
    const digest = createHash('sha256').update(bytes).digest('hex');
    if (digest !== artifact.sha256) throw new Error(`Specialist artifact sha256 mismatch: ${key}`);
    if (model.kind === 'generative') {
      for (const residentId of [...this.#resident]) {
        if (residentId !== key && this.#active.get(residentId)?.kind === 'generative') await this.unload(residentId);
      }
    }
    let mapping;
    let mappingMode;
    if (artifact.mapping === 'mmap-readonly') {
      mapping = await this.#mappingProvider.mapReadOnly({ path: artifact.path, byteLength: info.size, sha256: artifact.sha256 });
      if (!mapping || typeof mapping.slice !== 'function' || typeof mapping.close !== 'function') throw new TypeError('Native mmap provider returned an invalid read-only mapping');
      mappingMode = 'mmap-readonly';
    } else {
      const blob = await openAsBlob(artifact.path);
      mapping = {
        byteLength: blob.size,
        async slice(start, end) { return Buffer.from(await blob.slice(start, end).arrayBuffer()); },
        async close() {},
      };
      mappingMode = 'file-backed-blob';
    }
    const base = { schema: 'nolane.small-model.specialist-mapping.v1', id: key, version: model.version, mappingMode, byteLength: Number(mapping.byteLength ?? info.size), artifactSha256: artifact.sha256 };
    const view = deepFreeze({ ...base, mappingSha256: canonicalSha256(base) });
    this.#mapped.set(key, { mapping, view });
    this.#resident = [...this.#resident.filter((value) => value !== key), key];
    return view;
  }

  async readOnlySlice(id, start = 0, end = undefined) {
    const key = String(id);
    if (!this.#mapped.has(key)) await this.lazyLoad(key);
    const { mapping, view } = this.#mapped.get(key);
    const from = Math.max(0, Number(start) || 0);
    const to = end === undefined ? view.byteLength : Math.max(from, Math.min(view.byteLength, Number(end) || 0));
    return Buffer.from(await mapping.slice(from, to));
  }

  async unload(id) {
    const key = String(id);
    const mapped = this.#mapped.get(key);
    if (mapped) await mapped.mapping.close();
    this.#mapped.delete(key);
    this.#resident = this.#resident.filter((value) => value !== key);
    return deepFreeze({ schema: 'nolane.small-model.specialist-unload.v1', id: key, unloaded: Boolean(mapped) });
  }

  async pressureUnload({ availableMb, requiredFreeMb = 512 } = {}) {
    if (!Number.isFinite(Number(availableMb)) || !Number.isFinite(Number(requiredFreeMb))) throw new TypeError('Memory pressure values are required');
    const unloaded = [];
    if (Number(availableMb) < Number(requiredFreeMb)) {
      const ordered = [...this.#resident].sort((a, b) => (this.#artifacts.get(b)?.memoryMb ?? 0) - (this.#artifacts.get(a)?.memoryMb ?? 0) || a.localeCompare(b));
      for (const id of ordered) { await this.unload(id); unloaded.push(id); }
    }
    const base = { schema: 'nolane.small-model.specialist-pressure-unload.v1', availableMb: Number(availableMb), requiredFreeMb: Number(requiredFreeMb), unloaded };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }

  #trustFor(model, domain) {
    return this.#domainTrust.get(`${model.id}:${domain}`)?.trust ?? model.trust;
  }

  select({ capability, domain = '*' } = {}) {
    const options = [...this.#active.values()]
      .filter((model) => model.capabilities.includes(capability) && (model.domains.includes(domain) || model.domains.includes('*')))
      .sort((a, b) => this.#trustFor(b, domain) - this.#trustFor(a, domain) || a.id.localeCompare(b.id));
    if (!options.length) throw new Error(`No specialist for ${capability}/${domain}`);
    return options[0];
  }

  updateDomainTrust({ id, domain, success, verified, learningRate = 0.2 } = {}) {
    const model = this.#active.get(id);
    if (!model || !domain || verified !== true || typeof success !== 'boolean') throw new Error('Verified specialist outcome, id and domain are required');
    const rate = boundedNumber(learningRate, 'learningRate');
    const key = `${id}:${domain}`;
    const current = this.#domainTrust.get(key)?.trust ?? model.trust;
    const target = success ? 1 : 0;
    const trust = Number((current + rate * (target - current)).toFixed(6));
    const base = { schema: 'nolane.small-model.domain-trust.v1', id, version: model.version, domain: String(domain), success, trust };
    const receipt = deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
    this.#domainTrust.set(key, receipt);
    return receipt;
  }

  load(id) {
    const model = this.#active.get(id);
    if (!model) throw new Error(`Unknown specialist: ${id}`);
    if (model.kind === 'generative') this.#resident = this.#resident.filter((residentId) => this.#active.get(residentId)?.kind !== 'generative');
    this.#resident = [...this.#resident.filter((value) => value !== id), id];
    while (this.#resident.filter((residentId) => this.#active.get(residentId)?.kind === 'generative').length > this.#max) this.#resident.shift();
    return model;
  }

  applyMemoryPressure({ availableMb }) {
    if (Number(availableMb) < 512) this.#resident = [];
    return this.snapshot();
  }

  serialize(id, state) {
    const model = this.#active.get(id);
    if (!model) throw new Error(`Unknown specialist: ${id}`);
    if (model.serializer !== 'typed-v1') throw new Error('Unsupported model serializer');
    return serializeTypedModelState(state);
  }

  registerSharedSchema({ id, version, embeddingDimensions, stateFields } = {}) {
    if (!id || !version || !Number.isInteger(embeddingDimensions) || embeddingDimensions < 1 || !Array.isArray(stateFields) || stateFields.length === 0) {
      throw new TypeError('Shared schema id, version, embeddingDimensions and stateFields are required');
    }
    const base = {
      schema: 'nolane.small-model.shared-representation-schema.v1', id: String(id), version: String(version),
      embeddingDimensions, stateFields: [...new Set(stateFields.map(String))].sort(),
    };
    const record = deepFreeze({ ...base, schemaSha256: canonicalSha256(base) });
    this.#schemas.set(record.id, record);
    return record;
  }

  validateSharedRepresentation({ schemaId, embedding, state } = {}) {
    const schema = this.#schemas.get(schemaId);
    if (!schema) throw new Error(`Unknown shared schema: ${schemaId}`);
    if (!Array.isArray(embedding) || embedding.length !== schema.embeddingDimensions || embedding.some((value) => !Number.isFinite(Number(value)))) {
      throw new TypeError(`Embedding dimensions must equal ${schema.embeddingDimensions}`);
    }
    const projected = Object.fromEntries(schema.stateFields.filter((field) => Object.hasOwn(state ?? {}, field)).map((field) => [field, state[field]]));
    const base = {
      schema: 'nolane.small-model.shared-representation.v1', schemaId, schemaVersion: schema.version,
      embedding: embedding.map(Number), serializedState: serializeTypedModelState(projected),
    };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }

  recordBenchmark(input) {
    const base = { schema: 'nolane.small-model.specialist-benchmark.v1', ...input };
    const receipt = deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
    this.#receipts.push(receipt);
    return receipt;
  }

  recordIndependentBenchmark({ id, version, independent, heldOut, tasks, success, latencyMs, rssMbSeconds } = {}) {
    const model = this.#active.get(id);
    if (!model || model.version !== String(version)) throw new Error(`Unknown active specialist version: ${id}@${version}`);
    if (independent !== true) throw new Error('Specialist benchmark must be independent');
    if (heldOut !== true) throw new Error('Specialist benchmark must use held-out tasks');
    if (!Number.isInteger(tasks) || tasks < 1) throw new TypeError('Specialist benchmark tasks must be positive');
    const successValue = boundedNumber(success, 'benchmark success');
    if (![latencyMs, rssMbSeconds].every((value) => Number.isFinite(Number(value)) && Number(value) >= 0)) throw new TypeError('Benchmark resource metrics are required');
    const base = {
      schema: 'nolane.small-model.independent-specialist-benchmark.v1', id, version: String(version), independent: true,
      heldOut: true, tasks, success: successValue, latencyMs: Number(latencyMs), rssMbSeconds: Number(rssMbSeconds),
    };
    const receipt = deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
    this.#independentReceipts.set(`${id}@${version}`, receipt);
    return receipt;
  }

  certifyIndependentBenchmarks() {
    const specialists = [...this.#active.values()].map((model) => `${model.id}@${model.version}`).sort();
    const missing = specialists.filter((key) => !this.#independentReceipts.has(key));
    const base = { schema: 'nolane.small-model.specialist-benchmark-certification.v1', complete: missing.length === 0, specialists, missing };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }

  rollback(id) {
    const history = this.#versions.get(id) ?? [];
    if (history.length < 2) throw new Error(`No rollback version for specialist: ${id}`);
    history.pop();
    this.#versions.set(id, history);
    const active = history.at(-1);
    this.#active.set(id, active);
    this.#resident = this.#resident.filter((value) => value !== id);
    return active;
  }

  snapshot() {
    return deepFreeze({
      schema: 'nolane.small-model.specialist-fabric.v1', registered: this.#active.size, resident: [...this.#resident],
      benchmarkReceipts: this.#receipts.length, independentBenchmarkReceipts: this.#independentReceipts.size,
      domainTrustRecords: this.#domainTrust.size, sharedSchemas: this.#schemas.size, artifacts: this.#artifacts.size, mappedArtifacts: this.#mapped.size,
    });
  }
}
