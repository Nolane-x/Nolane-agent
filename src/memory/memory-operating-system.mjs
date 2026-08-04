import { randomUUID } from 'node:crypto';
import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const HASH = /^[a-f0-9]{64}$/i;
const OPERATIONS = new Set(['suppress', 'deprioritize', 'invalidate', 'archive', 'abstract', 'delete']);
const LAYERS = new Set(['subconscious', 'episodic', 'semantic_schema', 'exception']);
const PRIVATE_KEY = /(?:raw(?:Prompt|Output|Transcript)|chainOfThought|hiddenReasoning|secret|password|credential|authorization|api[_-]?key|access[_-]?token|refresh[_-]?token)/i;

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}
function text(value, label, max = 4_000) {
  const out = String(value ?? '').trim();
  if (!out) throw new TypeError(`${label} is required`);
  if (out.length > max) throw new TypeError(`${label} is too long`);
  return out;
}
function assertPublic(input) {
  const walk = (value) => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (PRIVATE_KEY.test(key)) throw new TypeError(`private or raw field is not allowed: ${key}`);
      walk(child);
    }
  };
  walk(input);
}
function requiredHash(value, label) {
  const out = String(value ?? '');
  if (!HASH.test(out)) throw new TypeError(`${label} must be a SHA-256 hash`);
  return out.toLowerCase();
}
function layerFor(memory, requested) {
  if (requested != null) {
    const layer = String(requested);
    if (!LAYERS.has(layer)) throw new TypeError(`unknown memory layer: ${layer}`);
    return layer;
  }
  const kind = String(memory?.kind ?? '').toLowerCase();
  if (kind.includes('exception')) return 'exception';
  if (kind.includes('semantic') || kind.includes('schema') || kind.includes('procedural')) return 'semantic_schema';
  if (kind.includes('subconscious') || kind.includes('buffer')) return 'subconscious';
  return 'episodic';
}
function scopeKey(scope = {}) {
  if (scope.taskId) return ['task', String(scope.taskId)];
  if (scope.contextId) return ['context', String(scope.contextId)];
  if (scope.branch) return ['branch', String(scope.branch)];
  if (scope.projectId) return ['project', String(scope.projectId)];
  return ['global', '*'];
}
function terms(value) { return [...new Set(String(value ?? '').toLowerCase().match(/[\p{L}\p{N}_/-]{2,}/gu) ?? [])].slice(0, 32); }
function signed(base) { return freeze({ ...base, receiptSha256: canonicalSha256(base) }); }

export class MemoryOperatingSystem {
  constructor({ store, memoryService, memorySidecar, clock = () => Date.now(), limits = {} } = {}) {
    if (!store?.db || !memoryService?.get || !memorySidecar?.revoke || !memorySidecar?.purge) throw new TypeError('MemoryOperatingSystem store, memoryService, and memorySidecar are required');
    this.store = store;
    this.memoryService = memoryService;
    this.memorySidecar = memorySidecar;
    this.clock = clock;
    this.maxVersions = Math.max(10, Math.min(100_000, Number(limits.maxVersions) || 20_000));
    this.store.db.exec(`
      CREATE TABLE IF NOT EXISTS memory_versions(
        version_id TEXT PRIMARY KEY,
        memory_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        version_number INTEGER NOT NULL,
        operation TEXT NOT NULL,
        layer TEXT NOT NULL,
        title TEXT,
        content TEXT,
        confidence REAL,
        valid_from_ms INTEGER NOT NULL,
        valid_until_ms INTEGER,
        parent_version_id TEXT,
        source_hash TEXT NOT NULL,
        actor TEXT NOT NULL,
        reason TEXT,
        evidence_receipt_sha256 TEXT NOT NULL,
        receipt_sha256 TEXT NOT NULL,
        created_at_ms INTEGER NOT NULL,
        UNIQUE(memory_id,version_number)
      );
      CREATE INDEX IF NOT EXISTS memory_versions_memory ON memory_versions(memory_id,version_number);
      CREATE INDEX IF NOT EXISTS memory_versions_project ON memory_versions(project_id,created_at_ms);
      CREATE TABLE IF NOT EXISTS memory_scopes(
        memory_id TEXT NOT NULL,
        scope_type TEXT NOT NULL,
        scope_id TEXT NOT NULL,
        suppressed INTEGER NOT NULL DEFAULT 0,
        priority_delta REAL NOT NULL DEFAULT 0,
        expires_at_ms INTEGER,
        reason TEXT,
        actor TEXT NOT NULL,
        receipt_sha256 TEXT NOT NULL,
        updated_at_ms INTEGER NOT NULL,
        PRIMARY KEY(memory_id,scope_type,scope_id)
      );
      CREATE TABLE IF NOT EXISTS memory_tombstones(
        memory_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        deleted_at_ms INTEGER NOT NULL,
        actor TEXT NOT NULL,
        reason TEXT NOT NULL,
        source_hash TEXT NOT NULL,
        receipt_sha256 TEXT NOT NULL
      );
    `);
  }

  #latest(memoryId) {
    return this.store.db.prepare('SELECT * FROM memory_versions WHERE memory_id=? ORDER BY version_number DESC LIMIT 1').get(String(memoryId)) ?? null;
  }

  #ensureSeed(memory, sourceHash, actor, evidenceReceiptSha256) {
    const latest = this.#latest(memory.id);
    if (latest) return latest;
    const at = Math.trunc(Number(this.clock()));
    const base = {
      schema: 'forge.memory-version.v1', versionId: `memv_${randomUUID().replaceAll('-', '')}`, memoryId: memory.id, projectId: memory.projectId,
      versionNumber: 1, operation: 'seed', layer: layerFor(memory), title: memory.title, content: memory.content, confidence: Number(memory.confidence ?? 0.5),
      validFromMs: at, validUntilMs: null, parentVersionId: null, sourceHash, actor, reason: 'initial-version', evidenceReceiptSha256, createdAtMs: at,
    };
    const row = signed(base);
    this.store.db.prepare(`INSERT INTO memory_versions(version_id,memory_id,project_id,version_number,operation,layer,title,content,confidence,valid_from_ms,valid_until_ms,parent_version_id,source_hash,actor,reason,evidence_receipt_sha256,receipt_sha256,created_at_ms)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(row.versionId, row.memoryId, row.projectId, row.versionNumber, row.operation, row.layer, row.title, row.content, row.confidence, row.validFromMs, row.validUntilMs, row.parentVersionId, row.sourceHash, row.actor, row.reason, row.evidenceReceiptSha256, row.receiptSha256, row.createdAtMs);
    return this.#latest(memory.id);
  }

  #row(row) {
    if (!row) return null;
    return freeze({
      versionId: row.version_id, memoryId: row.memory_id, projectId: row.project_id, versionNumber: Number(row.version_number), operation: row.operation,
      layer: row.layer, title: row.title, content: row.content, confidence: Number(row.confidence ?? 0), validFromMs: Number(row.valid_from_ms),
      validUntilMs: row.valid_until_ms == null ? null : Number(row.valid_until_ms), parentVersionId: row.parent_version_id, sourceHash: row.source_hash,
      actor: row.actor, reason: row.reason, evidenceReceiptSha256: row.evidence_receipt_sha256, receiptSha256: row.receipt_sha256, createdAtMs: Number(row.created_at_ms),
    });
  }

  async apply(input = {}) {
    assertPublic(input);
    const operation = String(input.operation ?? '');
    if (!OPERATIONS.has(operation)) throw new TypeError(`unknown memory operation: ${operation}`);
    const projectId = text(input.projectId, 'projectId', 256);
    const memoryId = text(input.memoryId, 'memoryId', 256);
    const actor = text(input.actor, 'actor', 256);
    const reason = text(input.reason ?? operation, 'reason', 1_000);
    const sourceHash = requiredHash(input.sourceHash, 'sourceHash');
    const evidenceReceiptSha256 = requiredHash(input.evidenceReceiptSha256, 'evidenceReceiptSha256');
    const memory = this.memoryService.get(memoryId);
    if (!memory || memory.projectId !== projectId) throw new Error(`Unknown project memory: ${memoryId}`);
    const seed = this.#ensureSeed(memory, sourceHash, actor, evidenceReceiptSha256);
    const parent = this.#latest(memoryId) ?? seed;
    const at = Math.trunc(Number(this.clock()));

    if (operation === 'delete') {
      if (input.privacy !== true && !/corrupt/i.test(reason)) throw new Error('delete requires privacy request or corruption reason');
      await this.memorySidecar.revoke(memoryId, { actor });
      await this.memorySidecar.purge(memoryId, { actor });
      this.store.transaction(() => {
        this.store.db.prepare('DELETE FROM memory_scopes WHERE memory_id=?').run(memoryId);
        this.store.db.prepare('DELETE FROM memory_versions WHERE memory_id=?').run(memoryId);
        const base = { schema: 'forge.memory-tombstone.v1', memoryId, projectId, deletedAtMs: at, actor, reason, sourceHash };
        const tombstone = signed(base);
        this.store.db.prepare('INSERT OR REPLACE INTO memory_tombstones(memory_id,project_id,deleted_at_ms,actor,reason,source_hash,receipt_sha256) VALUES(?,?,?,?,?,?,?)').run(memoryId, projectId, at, actor, reason, sourceHash, tombstone.receiptSha256);
      });
      const tombstone = this.store.db.prepare('SELECT * FROM memory_tombstones WHERE memory_id=?').get(memoryId);
      return freeze({ schema: 'forge.memory-operation.v1', operation, memoryId, projectId, deleted: true, actor, reason, deletedAtMs: at, receiptSha256: tombstone.receipt_sha256 });
    }

    if (operation === 'suppress' || operation === 'deprioritize') {
      const [scopeType, scopeId] = scopeKey(input.scope ?? {});
      const priorityDelta = operation === 'deprioritize' ? Math.max(-1, Math.min(0, Number(input.priorityDelta ?? -0.25))) : 0;
      const expiresAtMs = input.expiresAtMs == null ? null : Math.trunc(Number(input.expiresAtMs));
      const scopeBase = { schema: 'forge.memory-scope.v1', memoryId, projectId, scopeType, scopeId, suppressed: operation === 'suppress', priorityDelta, expiresAtMs, reason, actor, updatedAtMs: at };
      const scopeReceipt = signed(scopeBase);
      this.store.db.prepare(`INSERT INTO memory_scopes(memory_id,scope_type,scope_id,suppressed,priority_delta,expires_at_ms,reason,actor,receipt_sha256,updated_at_ms)
        VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(memory_id,scope_type,scope_id) DO UPDATE SET suppressed=excluded.suppressed,priority_delta=excluded.priority_delta,expires_at_ms=excluded.expires_at_ms,reason=excluded.reason,actor=excluded.actor,receipt_sha256=excluded.receipt_sha256,updated_at_ms=excluded.updated_at_ms`)
        .run(memoryId, scopeType, scopeId, operation === 'suppress' ? 1 : 0, priorityDelta, expiresAtMs, reason, actor, scopeReceipt.receiptSha256, at);
    }

    const closesParent = ['invalidate', 'archive', 'abstract'].includes(operation);
    const layer = operation === 'abstract' ? layerFor(memory, input.layer) : parent.layer;
    const title = operation === 'abstract' ? text(input.abstractedTitle ?? memory.title, 'abstractedTitle', 2_000) : parent.title;
    const content = operation === 'abstract' ? text(input.abstractedContent, 'abstractedContent', 100_000) : parent.content;
    if (closesParent && parent.valid_until_ms == null) this.store.db.prepare('UPDATE memory_versions SET valid_until_ms=? WHERE version_id=?').run(at, parent.version_id);
    const versionNumber = Number(parent.version_number) + 1;
    const base = {
      schema: 'forge.memory-version.v1', versionId: `memv_${randomUUID().replaceAll('-', '')}`, memoryId, projectId, versionNumber, operation,
      layer, title, content, confidence: Number(memory.confidence ?? parent.confidence ?? 0.5), validFromMs: at, validUntilMs: ['invalidate', 'archive'].includes(operation) ? at : null,
      parentVersionId: parent.version_id, sourceHash, actor, reason, evidenceReceiptSha256, createdAtMs: at,
    };
    const version = signed(base);
    this.store.db.prepare(`INSERT INTO memory_versions(version_id,memory_id,project_id,version_number,operation,layer,title,content,confidence,valid_from_ms,valid_until_ms,parent_version_id,source_hash,actor,reason,evidence_receipt_sha256,receipt_sha256,created_at_ms)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(version.versionId, memoryId, projectId, versionNumber, operation, layer, title, content, version.confidence, version.validFromMs, version.validUntilMs, version.parentVersionId, sourceHash, actor, reason, evidenceReceiptSha256, version.receiptSha256, at);
    this.#prune();
    return this.#row(this.store.db.prepare('SELECT * FROM memory_versions WHERE version_id=?').get(version.versionId));
  }

  #prune() {
    const count = Number(this.store.db.prepare('SELECT COUNT(*) AS count FROM memory_versions').get().count ?? 0);
    if (count <= this.maxVersions) return;
    const remove = count - this.maxVersions;
    this.store.db.prepare(`DELETE FROM memory_versions WHERE version_id IN (SELECT version_id FROM memory_versions ORDER BY created_at_ms,version_id LIMIT ?)` ).run(remove);
  }

  versions(memoryId) {
    return this.store.db.prepare('SELECT * FROM memory_versions WHERE memory_id=? ORDER BY version_number').all(String(memoryId)).map((row) => this.#row(row));
  }

  retrieve(projectId, query, { taskId = null, contextId = null, branch = null, limit = 20 } = {}) {
    const needles = terms(query);
    const now = Math.trunc(Number(this.clock()));
    const latestRows = this.store.db.prepare(`SELECT v.* FROM memory_versions v JOIN (SELECT memory_id,MAX(version_number) AS max_version FROM memory_versions WHERE project_id=? GROUP BY memory_id) latest ON latest.memory_id=v.memory_id AND latest.max_version=v.version_number WHERE v.project_id=?`).all(String(projectId), String(projectId));
    const scopeRows = this.store.db.prepare('SELECT * FROM memory_scopes WHERE expires_at_ms IS NULL OR expires_at_ms>?').all(now);
    const scopesByMemory = new Map();
    for (const row of scopeRows) {
      if (!scopesByMemory.has(row.memory_id)) scopesByMemory.set(row.memory_id, []);
      scopesByMemory.get(row.memory_id).push(row);
    }
    const layerWeight = { exception: 4, semantic_schema: 3, episodic: 2, subconscious: 1 };
    const output = [];
    for (const row of latestRows) {
      if (['invalidate', 'archive'].includes(row.operation) || row.valid_until_ms != null) continue;
      let suppressed = false; let priorityDelta = 0;
      for (const scope of scopesByMemory.get(row.memory_id) ?? []) {
        const matches = scope.scope_type === 'global'
          || (scope.scope_type === 'project' && scope.scope_id === String(projectId))
          || (scope.scope_type === 'task' && scope.scope_id === String(taskId ?? ''))
          || (scope.scope_type === 'context' && scope.scope_id === String(contextId ?? ''))
          || (scope.scope_type === 'branch' && scope.scope_id === String(branch ?? ''));
        if (!matches) continue;
        suppressed ||= Boolean(scope.suppressed);
        priorityDelta += Number(scope.priority_delta ?? 0);
      }
      if (suppressed) continue;
      const haystack = `${row.title ?? ''} ${row.content ?? ''}`.toLowerCase();
      const lexical = needles.length ? needles.filter((term) => haystack.includes(term)).length / needles.length : 1;
      if (needles.length && lexical === 0) continue;
      output.push(freeze({ memoryId: row.memory_id, versionId: row.version_id, title: row.title, content: row.content, layer: row.layer, priorityDelta, score: lexical + (layerWeight[row.layer] ?? 0) * 0.1 + priorityDelta, sourceHash: row.source_hash, receiptSha256: row.receipt_sha256 }));
    }
    return freeze(output.sort((a, b) => b.score - a.score || b.versionId.localeCompare(a.versionId)).slice(0, Math.max(1, Math.min(200, Number(limit) || 20))));
  }

  snapshot(projectId = null) {
    const where = projectId == null ? '' : ' WHERE project_id=?';
    const args = projectId == null ? [] : [String(projectId)];
    const versions = Number(this.store.db.prepare(`SELECT COUNT(*) AS count FROM memory_versions${where}`).get(...args).count ?? 0);
    const tombstones = Number(this.store.db.prepare(`SELECT COUNT(*) AS count FROM memory_tombstones${where}`).get(...args).count ?? 0);
    const base = { schema: 'forge.memory-operating-system-snapshot.v1', projectId: projectId == null ? null : String(projectId), versions, tombstones, claims: { hiddenReasoningStored: false, rawPromptsStored: false, privacyDeletionPreservesContent: false } };
    return signed(base);
  }
}
