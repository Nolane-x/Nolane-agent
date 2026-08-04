import { createHash } from 'node:crypto';

function clean(value, max = 512) { return String(value ?? '').trim().slice(0, max); }
function normalizePath(value) { return clean(value, 2_000).replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/{2,}/g, '/'); }
function stable(value) { if (Array.isArray(value)) return value.map(stable); if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])); return value; }
function sha256(value) { return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex'); }
function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; for (const item of Object.values(value)) freeze(item); return Object.freeze(value); }
function safeMetadata(metadata = {}) {
  const allowed = ['language', 'source', 'reason', 'priority', 'consumerHint', 'symbol', 'operation'];
  const output = {};
  for (const key of allowed) { const value = clean(metadata?.[key], 256); if (value) output[key] = value; }
  return freeze(output);
}

export class IncrementalIntelligenceJournal {
  constructor({ maxEntries = 20_000, clock = () => Date.now(), eventSink = () => {} } = {}) {
    this.maxEntries = Math.max(1, Math.floor(Number(maxEntries) || 20_000));
    this.clock = clock;
    this.eventSink = typeof eventSink === 'function' ? eventSink : () => {};
    this.sequence = 0;
    this.retentionFloorCursor = 0;
    this.entries = [];
    this.latestByPath = new Map();
    this.consumers = new Map();
  }

  #view(record, extra = {}) {
    const base = {
      schema: 'forge.incremental-intelligence-change.v1', cursor: record.cursor, projectId: record.projectId,
      path: record.path, contentHash: record.contentHash, generation: record.generation, kind: record.kind,
      priority: record.priority, metadata: record.metadata, supersedesCursor: record.supersedesCursor,
      publishedAtMs: record.publishedAtMs, ...extra,
    };
    return freeze({ ...base, receiptSha256: sha256(base) });
  }

  publish({ projectId, path, contentHash, generation = 'current', kind = 'modify', priority = 'mission', metadata = {} } = {}) {
    const project = clean(projectId, 512); if (!project) throw new TypeError('projectId is required');
    const filePath = normalizePath(path); if (!filePath) throw new TypeError('path is required');
    const hash = clean(contentHash, 512); if (!hash) throw new TypeError('contentHash is required');
    const gen = clean(generation, 512) || 'current';
    const key = `${project}:${filePath}`;
    const previous = this.latestByPath.get(key);
    if (previous && previous.contentHash === hash && previous.generation === gen && previous.kind === clean(kind, 64)) return this.#view(previous, { coalesced: true });
    const record = {
      cursor: ++this.sequence, projectId: project, path: filePath, contentHash: hash, generation: gen,
      kind: clean(kind, 64) || 'modify', priority: clean(priority, 64) || 'mission', metadata: safeMetadata(metadata),
      supersedesCursor: previous?.cursor ?? null, publishedAtMs: this.clock(),
    };
    this.entries.push(record); this.latestByPath.set(key, record);
    while (this.entries.length > this.maxEntries) {
      const removed = this.entries.shift(); this.retentionFloorCursor = Math.max(this.retentionFloorCursor, removed.cursor);
      const latest = this.latestByPath.get(`${removed.projectId}:${removed.path}`);
      if (latest === removed) this.latestByPath.delete(`${removed.projectId}:${removed.path}`);
    }
    const view = this.#view(record, { coalesced: false });
    try { void this.eventSink(view); } catch {}
    return view;
  }

  readBatch({ consumerId, projectId, limit = 100 } = {}) {
    const consumer = clean(consumerId, 256); if (!consumer) throw new TypeError('consumerId is required');
    const project = clean(projectId, 512); if (!project) throw new TypeError('projectId is required');
    const cursor = this.consumers.get(consumer) ?? this.retentionFloorCursor;
    const newest = new Map();
    for (const record of this.entries) {
      if (record.projectId !== project || record.cursor <= cursor) continue;
      const latest = this.latestByPath.get(`${record.projectId}:${record.path}`);
      if (latest !== record) continue;
      newest.set(record.path, record);
    }
    const items = [...newest.values()].sort((a, b) => a.cursor - b.cursor).slice(0, Math.max(1, Math.min(5_000, Math.floor(Number(limit) || 100)))).map((record) => this.#view(record));
    const base = { schema: 'forge.incremental-intelligence-batch.v1', consumerId: consumer, projectId: project, acknowledgedCursor: cursor, retentionFloorCursor: this.retentionFloorCursor, latestCursor: this.sequence, items };
    return freeze({ ...base, receiptSha256: sha256(base) });
  }

  ack({ consumerId, cursor } = {}) {
    const consumer = clean(consumerId, 256); if (!consumer) throw new TypeError('consumerId is required');
    const next = Number(cursor); if (!Number.isInteger(next) || next < 0 || next > this.sequence) throw new TypeError('cursor is invalid');
    const previous = this.consumers.get(consumer) ?? this.retentionFloorCursor;
    if (next < previous) throw Object.assign(new Error('consumer cursor must be monotonic'), { code: 'INTELLIGENCE_CURSOR_NON_MONOTONIC' });
    this.consumers.set(consumer, next);
    const base = { schema: 'forge.incremental-intelligence-ack.v1', consumerId: consumer, previousCursor: previous, cursor: next, acknowledgedAtMs: this.clock() };
    return freeze({ ...base, receiptSha256: sha256(base) });
  }

  invalidateProject(projectId) {
    const project = clean(projectId, 512); if (!project) throw new TypeError('projectId is required');
    return this.publish({ projectId: project, path: '*', contentHash: sha256({ project, cursor: this.sequence + 1 }), generation: `invalidate:${this.sequence + 1}`, kind: 'invalidate', priority: 'interactive', metadata: { source: 'project-invalidation' } });
  }

  snapshot() {
    const entries = this.entries.map((record) => this.#view(record));
    const consumers = [...this.consumers.entries()].map(([consumerId, cursor]) => ({ consumerId, cursor })).sort((a, b) => a.consumerId.localeCompare(b.consumerId));
    const base = { schema: 'forge.incremental-intelligence-journal-snapshot.v1', latestCursor: this.sequence, retentionFloorCursor: this.retentionFloorCursor, entries, consumers };
    return freeze({ ...base, receiptSha256: sha256(base) });
  }
}
