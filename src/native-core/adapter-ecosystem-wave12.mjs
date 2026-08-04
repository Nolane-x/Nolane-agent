import { createHash, verify as verifySignature } from 'node:crypto';
import { lstat, readdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { atomicWriteJson, readJson, redact, sha256 } from './native-runtime-utils.mjs';

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
};

const stableJson = (value) => JSON.stringify(canonicalize(value));

const codedError = (code, message) => Object.assign(new Error(message), { code });

const clone = (value) => structuredClone(value);

export class FileMemoryAdapterWave12 {
  constructor({ file, retentionLimit = 10_000, clock = () => Date.now() } = {}) {
    if (!file) throw new TypeError('file is required');
    if (!Number.isInteger(retentionLimit) || retentionLimit < 1) throw new TypeError('retentionLimit must be a positive integer');
    this.file = path.resolve(file);
    this.retentionLimit = retentionLimit;
    this.clock = clock;
    this.state = { schema: 'nolane.memory.file.v1', revision: 0, records: {} };
  }

  async open() {
    const stored = await readJson(this.file, null);
    if (stored) {
      if (stored.schema !== 'nolane.memory.file.v1' || typeof stored.records !== 'object') {
        throw codedError('MEMORY_STORE_INVALID', 'Memory store schema is invalid');
      }
      this.state = stored;
    }
    return this.snapshot();
  }

  async #persist() {
    await atomicWriteJson(this.file, this.state);
  }

  async put({ id, text, provenance = {}, expectedVersion } = {}) {
    if (!id) throw new TypeError('id is required');
    if (typeof text !== 'string') throw new TypeError('text must be a string');
    const key = String(id);
    const current = this.state.records[key] ?? null;
    const currentVersion = current?.version ?? 0;
    if (expectedVersion !== undefined && expectedVersion !== currentVersion) {
      throw codedError('VERSION_CONFLICT', `Expected memory version ${expectedVersion}, found ${currentVersion}`);
    }
    const now = Number(this.clock());
    const record = {
      id: key,
      text,
      provenance: redact(clone(provenance)),
      version: currentVersion + 1,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
      contentSha256: sha256(text),
    };
    this.state.records[key] = record;
    this.state.revision += 1;
    const ordered = Object.values(this.state.records).sort((left, right) => left.updatedAt - right.updatedAt || left.id.localeCompare(right.id));
    while (ordered.length > this.retentionLimit) {
      const oldest = ordered.shift();
      delete this.state.records[oldest.id];
    }
    await this.#persist();
    return clone(record);
  }

  get(id) {
    const record = this.state.records[String(id)] ?? null;
    return record ? clone(record) : null;
  }

  query(input, { limit = 20 } = {}) {
    const needle = String(input ?? '').trim().toLowerCase();
    if (!needle) return [];
    return Object.values(this.state.records)
      .filter((record) => record.text.toLowerCase().includes(needle) || stableJson(record.provenance).toLowerCase().includes(needle))
      .sort((left, right) => right.updatedAt - left.updatedAt || left.id.localeCompare(right.id))
      .slice(0, Math.max(0, Number(limit)))
      .map(clone);
  }

  async delete({ id, expectedVersion } = {}) {
    if (!id) throw new TypeError('id is required');
    const key = String(id);
    const current = this.state.records[key] ?? null;
    if (!current) return { deleted: false, id: key };
    if (expectedVersion !== undefined && expectedVersion !== current.version) {
      throw codedError('VERSION_CONFLICT', `Expected memory version ${expectedVersion}, found ${current.version}`);
    }
    delete this.state.records[key];
    this.state.revision += 1;
    await this.#persist();
    return { deleted: true, id: key, version: current.version };
  }

  snapshot() {
    const records = Object.values(this.state.records).sort((left, right) => left.id.localeCompare(right.id));
    return {
      schema: this.state.schema,
      revision: this.state.revision,
      recordCount: records.length,
      records: records.map(clone),
      receiptSha256: sha256(stableJson({ revision: this.state.revision, records })),
    };
  }
}

export class MemoryProviderTckWave12 {
  async verify(adapter) {
    try {
      await adapter.open();
      await adapter.put({ id: 'tck-memory', text: 'nolane tck value', provenance: { source: 'tck' } });
      const first = adapter.get('tck-memory');
      if (first?.version !== 1 || !adapter.query('nolane').some((record) => record.id === 'tck-memory')) {
        throw new Error('put/get/query contract failed');
      }
      let conflict = false;
      try {
        await adapter.put({ id: 'tck-memory', text: 'invalid', expectedVersion: 0 });
      } catch (error) {
        conflict = error?.code === 'VERSION_CONFLICT';
      }
      if (!conflict) throw new Error('version conflict contract failed');
      await adapter.delete({ id: 'tck-memory', expectedVersion: 1 });
      if (adapter.get('tck-memory') !== null) throw new Error('delete contract failed');
      return { status: 'pass', checks: 4, adapter: adapter.constructor.name };
    } catch (error) {
      return { status: 'fail', error: error.message, adapter: adapter?.constructor?.name ?? 'unknown' };
    }
  }
}

export class SignedPluginHostWave12 {
  constructor({ allowedCapabilities = [], compatibleApiVersion = 1 } = {}) {
    this.allowedCapabilities = new Set(allowedCapabilities.map(String));
    this.compatibleApiVersion = Number(compatibleApiVersion);
    this.plugins = new Map();
    this.history = new Map();
    this.transparency = [];
  }

  signingPayload({ manifest, content } = {}) {
    if (!manifest?.id || !manifest?.version) throw new TypeError('plugin manifest id and version are required');
    return stableJson({ manifest, contentSha256: sha256(String(content ?? '')) });
  }

  #appendTransparency(type, payload) {
    const previousSha256 = this.transparency.at(-1)?.sha256 ?? null;
    const entry = {
      sequence: this.transparency.length + 1,
      type,
      payload: canonicalize(payload),
      previousSha256,
    };
    entry.sha256 = sha256(stableJson(entry));
    this.transparency.push(Object.freeze(entry));
    return entry;
  }

  install(pkg = {}) {
    const { manifest, content, signature, publicKey } = pkg;
    if (!manifest?.id || !manifest?.version) throw new TypeError('plugin manifest id and version are required');
    if (Number(manifest.apiVersion) !== this.compatibleApiVersion) {
      throw codedError('PLUGIN_API_INCOMPATIBLE', `Plugin API ${manifest.apiVersion} is incompatible`);
    }
    const denied = (manifest.capabilities ?? []).map(String).filter((capability) => !this.allowedCapabilities.has(capability));
    if (denied.length) throw codedError('PLUGIN_CAPABILITY_DENIED', `Denied plugin capabilities: ${denied.join(', ')}`);
    let valid = false;
    try {
      valid = verifySignature(null, Buffer.from(this.signingPayload({ manifest, content })), publicKey, Buffer.from(String(signature), 'base64'));
    } catch {
      valid = false;
    }
    if (!valid) throw codedError('PLUGIN_SIGNATURE_INVALID', 'Plugin package signature is invalid');
    const id = String(manifest.id);
    const current = this.plugins.get(id);
    if (current) {
      const versions = this.history.get(id) ?? [];
      versions.push(clone(current));
      this.history.set(id, versions);
    }
    const installed = {
      id,
      version: String(manifest.version),
      apiVersion: Number(manifest.apiVersion),
      capabilities: [...(manifest.capabilities ?? [])].map(String).sort(),
      contributions: clone(manifest.contributions ?? {}),
      contentSha256: sha256(String(content ?? '')),
      publicKeySha256: sha256(String(publicKey)),
      state: 'installed',
    };
    this.plugins.set(id, installed);
    this.#appendTransparency('plugin.installed', installed);
    return clone(installed);
  }

  activate(id) {
    const plugin = this.#require(id);
    plugin.state = 'active';
    this.#appendTransparency('plugin.activated', { id: plugin.id, version: plugin.version });
    return clone(plugin);
  }

  disable(id) {
    const plugin = this.#require(id);
    plugin.state = 'disabled';
    this.#appendTransparency('plugin.disabled', { id: plugin.id, version: plugin.version });
    return clone(plugin);
  }

  rollback(id) {
    const key = String(id);
    const versions = this.history.get(key) ?? [];
    const previous = versions.pop();
    if (!previous) throw codedError('PLUGIN_ROLLBACK_UNAVAILABLE', `No rollback version exists for ${key}`);
    this.history.set(key, versions);
    this.plugins.set(key, previous);
    this.#appendTransparency('plugin.rolled-back', { id: key, version: previous.version });
    return clone(previous);
  }

  #require(id) {
    const plugin = this.plugins.get(String(id));
    if (!plugin) throw codedError('PLUGIN_NOT_FOUND', `Plugin ${id} is not installed`);
    return plugin;
  }

  snapshot() {
    return {
      schema: 'nolane.plugin-host.wave12.v1',
      plugins: [...this.plugins.values()].sort((left, right) => left.id.localeCompare(right.id)).map(clone),
      transparencyEntries: this.transparency.length,
      transparencyHead: this.transparency.at(-1)?.sha256 ?? sha256(''),
    };
  }
}

export class DurableAdapterSchedulerWave12 {
  constructor({ file, clock = () => Date.now(), handler } = {}) {
    if (!file) throw new TypeError('file is required');
    if (typeof handler !== 'function') throw new TypeError('handler is required');
    this.file = path.resolve(file);
    this.clock = clock;
    this.handler = handler;
    this.state = { schema: 'nolane.scheduler.adapter.v1', revision: 0, lastObservedAt: null, jobs: {} };
  }

  async open() {
    const stored = await readJson(this.file, null);
    if (stored) {
      if (stored.schema !== 'nolane.scheduler.adapter.v1' || typeof stored.jobs !== 'object') {
        throw codedError('SCHEDULER_STORE_INVALID', 'Scheduler store schema is invalid');
      }
      this.state = stored;
    }
    return this.snapshot();
  }

  async #persist() {
    await atomicWriteJson(this.file, this.state);
  }

  async schedule({ id, runAt, payload = {} } = {}) {
    if (!id) throw new TypeError('job id is required');
    if (!Number.isFinite(Number(runAt))) throw new TypeError('runAt must be numeric');
    const key = String(id);
    const existing = this.state.jobs[key];
    const normalized = { id: key, runAt: Number(runAt), payload: redact(clone(payload)), delivered: false, attempts: 0, deliveredAt: null };
    if (existing) {
      if (stableJson(existing.payload) === stableJson(normalized.payload) && existing.runAt === normalized.runAt) return { ...clone(existing), duplicate: true };
      throw codedError('SCHEDULER_JOB_CONFLICT', `Job ${key} already exists with different content`);
    }
    this.state.jobs[key] = normalized;
    this.state.revision += 1;
    await this.#persist();
    return clone(normalized);
  }

  async runDue() {
    const observed = Number(this.clock());
    const effectiveNow = this.state.lastObservedAt === null ? observed : Math.max(observed, this.state.lastObservedAt);
    this.state.lastObservedAt = effectiveNow;
    const due = Object.values(this.state.jobs)
      .filter((job) => !job.delivered && job.runAt <= effectiveNow)
      .sort((left, right) => left.runAt - right.runAt || left.id.localeCompare(right.id));
    const delivered = [];
    for (const job of due) {
      job.attempts += 1;
      await this.#persist();
      await this.handler(clone(job));
      job.delivered = true;
      job.deliveredAt = effectiveNow;
      this.state.revision += 1;
      await this.#persist();
      delivered.push(clone(job));
    }
    if (!due.length) await this.#persist();
    return delivered;
  }

  snapshot() {
    const jobs = Object.values(this.state.jobs).sort((left, right) => left.id.localeCompare(right.id));
    return {
      schema: this.state.schema,
      revision: this.state.revision,
      lastObservedAt: this.state.lastObservedAt,
      jobs: jobs.map(clone),
      pending: jobs.filter((job) => !job.delivered).length,
      delivered: jobs.filter((job) => job.delivered).length,
      receiptSha256: sha256(stableJson(jobs)),
    };
  }
}

export class KanbanSyncEngineWave12 {
  constructor() {
    this.cards = new Map();
  }

  apply(card = {}) {
    if (!card.id || !Number.isInteger(card.version) || card.version < 1) throw new TypeError('card id and positive integer version are required');
    const normalized = canonicalize(clone(card));
    const key = String(card.id);
    const current = this.cards.get(key);
    if (current) {
      if (normalized.version < current.version) throw codedError('KANBAN_STALE_WRITE', `Card ${key} is stale`);
      if (normalized.version === current.version) {
        if (stableJson(normalized) === stableJson(current)) return { card: clone(current), duplicate: true };
        throw codedError('KANBAN_CONFLICT', `Card ${key} has conflicting version ${normalized.version}`);
      }
    }
    this.cards.set(key, normalized);
    return { card: clone(normalized), duplicate: false };
  }

  snapshot() {
    const values = [...this.cards.values()].sort((left, right) => String(left.id).localeCompare(String(right.id)));
    return {
      schema: 'nolane.kanban-sync.wave12.v1',
      cards: values.length,
      items: values.map(clone),
      receiptSha256: sha256(stableJson(values)),
    };
  }
}

export class ObservabilityAdapterWave12 {
  constructor({ maxQueue = 1_000, exporter } = {}) {
    if (!Number.isInteger(maxQueue) || maxQueue < 1) throw new TypeError('maxQueue must be a positive integer');
    if (!exporter || typeof exporter.connected !== 'function' || typeof exporter.export !== 'function') {
      throw new TypeError('exporter with connected() and export() is required');
    }
    this.maxQueue = maxQueue;
    this.exporter = exporter;
    this.queue = [];
    this.exported = 0;
  }

  record(event) {
    if (this.queue.length >= this.maxQueue) throw codedError('OBSERVABILITY_BACKPRESSURE', 'Observability queue is full');
    const safe = redact(clone(event));
    safe.eventSha256 = sha256(stableJson(safe));
    this.queue.push(safe);
    return clone(safe);
  }

  async flush() {
    if (!this.exporter.connected()) return { exported: 0, queued: this.queue.length, connected: false };
    if (!this.queue.length) return { exported: 0, queued: 0, connected: true };
    const batch = this.queue.map(clone);
    await this.exporter.export(batch);
    this.queue.splice(0, batch.length);
    this.exported += batch.length;
    return { exported: batch.length, queued: this.queue.length, connected: true };
  }

  snapshot() {
    return {
      schema: 'nolane.observability-adapter.wave12.v1',
      queued: this.queue.length,
      exported: this.exported,
      connected: Boolean(this.exporter.connected()),
      queueHeadSha256: this.queue.at(-1)?.eventSha256 ?? null,
    };
  }
}

async function treeBytes(target) {
  const info = await lstat(target);
  if (info.isSymbolicLink()) return 0;
  if (info.isFile()) return info.size;
  if (!info.isDirectory()) return 0;
  let total = 0;
  for (const entry of await readdir(target)) total += await treeBytes(path.join(target, entry));
  return total;
}

export class OperationsUtilityCompatWave12 {
  constructor({ root } = {}) {
    if (!root) throw new TypeError('root is required');
    this.root = path.resolve(root);
  }

  #resolve(relativePath) {
    const target = path.resolve(this.root, String(relativePath ?? ''));
    const relative = path.relative(this.root, target);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      throw codedError('PATH_OUTSIDE_ROOT', 'Cleanup path must be a non-root descendant of the configured root');
    }
    return target;
  }

  async cleanup({ relativePath } = {}) {
    const target = this.#resolve(relativePath);
    let removedBytes = 0;
    try {
      removedBytes = await treeBytes(target);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    await rm(target, { recursive: true, force: true });
    return {
      schema: 'nolane.operations-cleanup.wave12.v1',
      relativePath: path.relative(this.root, target).replaceAll('\\', '/'),
      removedBytes,
      receiptSha256: sha256(`${path.relative(this.root, target)}:${removedBytes}`),
    };
  }
}

export class AdapterEcosystemRuntimeWave12 {
  constructor({ dataDir, clock = () => Date.now(), schedulerHandler = async () => {}, observabilityExporter } = {}) {
    if (!dataDir) throw new TypeError('dataDir is required');
    this.dataDir = path.resolve(dataDir);
    this.memory = new FileMemoryAdapterWave12({ file: path.join(this.dataDir, 'memory.json'), clock });
    this.plugins = new SignedPluginHostWave12({
      allowedCapabilities: ['tool:read', 'tool:write', 'command:contribute', 'provider:contribute'],
      compatibleApiVersion: 1,
    });
    this.scheduler = new DurableAdapterSchedulerWave12({ file: path.join(this.dataDir, 'scheduler.json'), clock, handler: schedulerHandler });
    this.kanban = new KanbanSyncEngineWave12();
    this.observability = new ObservabilityAdapterWave12({
      maxQueue: 1_000,
      exporter: observabilityExporter ?? { connected: () => false, export: async () => {} },
    });
    this.operations = new OperationsUtilityCompatWave12({ root: path.join(this.dataDir, 'cleanup') });
  }

  async open() {
    await Promise.all([this.memory.open(), this.scheduler.open()]);
    return this.snapshot();
  }

  snapshot() {
    const status = {
      schema: 'nolane.adapter-ecosystem.wave12.v1',
      memory: this.memory.snapshot(),
      plugins: this.plugins.snapshot(),
      scheduler: this.scheduler.snapshot(),
      kanban: this.kanban.snapshot(),
      observability: this.observability.snapshot(),
    };
    return { ...status, receiptSha256: createHash('sha256').update(stableJson(status)).digest('hex') };
  }
}
