import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const HASH = /^[a-f0-9]{64}$/i;
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function boundedTtl(value) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10 * 365 * 24 * 60 * 60_000) throw new TypeError('ttlMs must be between 1 and 315360000000');
  return parsed;
}

function normalizeCitation(citation) {
  if (!citation || typeof citation !== 'object') throw new TypeError('memory citation must be an object');
  const relativePath = String(citation.path ?? '').replaceAll('\\', '/');
  if (!relativePath || path.posix.isAbsolute(relativePath) || relativePath.split('/').includes('..')) throw new TypeError('memory citation path must be workspace-relative');
  const startLine = Number(citation.startLine ?? 1); const endLine = Number(citation.endLine ?? startLine);
  if (!Number.isInteger(startLine) || !Number.isInteger(endLine) || startLine < 1 || endLine < startLine) throw new TypeError('memory citation line range is invalid');
  const digest = String(citation.sha256 ?? '');
  if (!HASH.test(digest)) throw new TypeError('memory citation sha256 is required');
  return Object.freeze({ path: relativePath, startLine, endLine, sha256: digest.toLowerCase(), commit: citation.commit == null ? null : String(citation.commit).slice(0, 128) });
}

export class ProjectMemorySidecar {
  constructor({ store, memoryService, clock = Date.now } = {}) {
    if (!store?.db || !memoryService) throw new TypeError('ProjectMemorySidecar store and memoryService are required');
    this.store = store; this.memoryService = memoryService; this.clock = clock;
    this.store.db.exec(`
      CREATE TABLE IF NOT EXISTS memory_sidecar_metadata(
        memory_id TEXT PRIMARY KEY REFERENCES memory_items(id) ON DELETE CASCADE,
        ttl_ms INTEGER,
        expires_at INTEGER,
        created_commit TEXT,
        updated_by TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS memory_citations(
        memory_id TEXT NOT NULL REFERENCES memory_items(id) ON DELETE CASCADE,
        ordinal INTEGER NOT NULL,
        path TEXT NOT NULL,
        start_line INTEGER NOT NULL,
        end_line INTEGER NOT NULL,
        sha256 TEXT NOT NULL,
        commit_sha TEXT,
        PRIMARY KEY(memory_id,ordinal)
      );
      CREATE TABLE IF NOT EXISTS memory_sidecar_audit(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        memory_id TEXT NOT NULL,
        action TEXT NOT NULL,
        actor TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);
  }

  get(id) {
    const memory = this.memoryService.get(id);
    if (!memory) return null;
    return Object.freeze({ ...memory, ...this.#metadata(id), citations: this.#citations(id) });
  }

  async propose({ projectId, title, content, kind = 'episodic', confidence = 0.5, sourceTaskId = null, citations = [], ttlMs = null, createdCommit = null, actor = 'memory-sidecar' } = {}) {
    const normalizedCitations = citations.map(normalizeCitation);
    const ttl = boundedTtl(ttlMs);
    const observed = await this.memoryService.observe({ projectId, title, content, kind, confidence, sourceTaskId, actor });
    const candidate = await this.memoryService.transition(observed.id, 'candidate', { actor });
    const stamp = Math.trunc(this.clock());
    const expiresAt = ttl === null ? null : stamp + ttl;
    this.store.transaction(() => {
      this.store.db.prepare('INSERT INTO memory_sidecar_metadata(memory_id,ttl_ms,expires_at,created_commit,updated_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').run(candidate.id, ttl, expiresAt, createdCommit == null ? null : String(createdCommit), String(actor), stamp, stamp);
      const insert = this.store.db.prepare('INSERT INTO memory_citations(memory_id,ordinal,path,start_line,end_line,sha256,commit_sha) VALUES(?,?,?,?,?,?,?)');
      normalizedCitations.forEach((citation, index) => insert.run(candidate.id, index, citation.path, citation.startLine, citation.endLine, citation.sha256, citation.commit));
      this.#audit(candidate.id, 'propose', actor, stamp);
    });
    return this.get(candidate.id);
  }

  async approve(id, { actor, evidenceReceiptSha256 } = {}) {
    if (!String(actor ?? '').trim()) throw new TypeError('approval actor is required');
    let current = this.memoryService.get(id);
    if (!current) throw new Error(`Unknown memory: ${id}`);
    if (current.status === 'stale') current = await this.memoryService.transition(id, 'candidate', { actor });
    if (current.status !== 'candidate') throw new Error(`Memory must be candidate before approval, got ${current.status}`);
    const approved = await this.memoryService.transition(id, 'approved', { actor, evidenceReceiptSha256 });
    await this.memoryService.transition(approved.id, 'active', { actor, evidenceReceiptSha256 });
    const stamp = Math.trunc(this.clock());
    this.store.db.prepare('UPDATE memory_sidecar_metadata SET updated_by=?,updated_at=? WHERE memory_id=?').run(String(actor), stamp, id);
    this.#audit(id, 'approve', actor, stamp);
    return this.get(id);
  }

  async edit(id, { actor, title, content, confidence } = {}) {
    if (!String(actor ?? '').trim()) throw new TypeError('edit actor is required');
    let current = this.memoryService.get(id);
    if (!current) throw new Error(`Unknown memory: ${id}`);
    if (current.status === 'active') current = await this.memoryService.transition(id, 'stale', { actor });
    if (current.status === 'stale') current = await this.memoryService.transition(id, 'candidate', { actor });
    if (!['observed', 'candidate', 'approved'].includes(current.status)) throw new Error(`Memory in ${current.status} cannot be edited`);
    if (current.status === 'approved') throw new Error('Approved memory must be activated or revoked before editing');
    const updated = await this.memoryService.update(id, { title, content, confidence, actor });
    const stamp = Math.trunc(this.clock());
    this.store.db.prepare('UPDATE memory_sidecar_metadata SET updated_by=?,updated_at=? WHERE memory_id=?').run(String(actor), stamp, id);
    this.#audit(id, 'edit', actor, stamp);
    return this.get(updated.id);
  }

  async revoke(id, { actor } = {}) {
    if (!String(actor ?? '').trim()) throw new TypeError('revoke actor is required');
    const current = this.memoryService.get(id);
    if (!current) throw new Error(`Unknown memory: ${id}`);
    const revoked = current.status === 'revoked' ? current : await this.memoryService.transition(id, 'revoked', { actor });
    const stamp = Math.trunc(this.clock()); this.#audit(id, 'revoke', actor, stamp);
    return this.get(revoked.id);
  }

  async purge(id, { actor } = {}) {
    if (!String(actor ?? '').trim()) throw new TypeError('purge actor is required');
    const current = this.memoryService.get(id);
    if (!current) return false;
    if (current.status !== 'revoked') throw new Error('Memory must be revoked before purge');
    const stamp = Math.trunc(this.clock());
    // Audit the destructive choice before cascading metadata deletion.
    this.#audit(id, 'purge', actor, stamp);
    await this.memoryService.purge(id, { actor });
    return Object.freeze({ id: String(id), purged: true, actor: String(actor), purgedAt: stamp });
  }

  async verifyFreshness(id) {
    const memory = this.memoryService.get(id);
    if (!memory) throw new Error(`Unknown memory: ${id}`);
    const metadata = this.#metadata(id);
    if (metadata.expiresAt !== null && this.clock() > metadata.expiresAt) return await this.#stale(memory, 'expired');
    const project = this.store.getProject(memory.projectId);
    if (!project) throw new Error(`Unknown project: ${memory.projectId}`);
    for (const citation of this.#citations(id)) {
      const absolute = path.resolve(project.workspaceRoot, citation.path);
      const relative = path.relative(path.resolve(project.workspaceRoot), absolute);
      if (relative.startsWith('..') || path.isAbsolute(relative)) return await this.#stale(memory, 'citation_outside_workspace');
      let bytes;
      try { bytes = await readFile(absolute); }
      catch { return await this.#stale(memory, 'citation_missing'); }
      if (sha256(bytes) !== citation.sha256) return await this.#stale(memory, 'citation_changed');
    }
    return Object.freeze({ fresh: memory.status === 'active', reason: memory.status === 'active' ? 'fresh' : `status_${memory.status}`, memory: this.get(id) });
  }

  async context(projectId, query, { maxItems = 8, maxChars = 12_000 } = {}) {
    const output = []; let used = 0;
    for (const memory of this.memoryService.search(projectId, query, { statuses: ['active'], limit: maxItems * 3 })) {
      const freshness = await this.verifyFreshness(memory.id);
      if (!freshness.fresh) continue;
      const enriched = this.get(memory.id);
      const citationText = enriched.citations.map((citation) => `${citation.path}:${citation.startLine}-${citation.endLine}@${citation.sha256.slice(0, 12)}`).join(', ');
      const text = `[approved-project-memory]\nTitle: ${enriched.title}\nConfidence: ${enriched.confidence}\nEvidence: ${enriched.evidenceReceiptSha256}\nCitations: ${citationText || 'none'}\n${enriched.content}`;
      if (used + text.length > maxChars) continue;
      output.push(Object.freeze({ id: `memory:${enriched.id}`, text, sha256: enriched.evidenceReceiptSha256, priority: Math.round(enriched.confidence * 1_000), metadata: { memoryId: enriched.id, kind: enriched.kind, status: enriched.status, citations: enriched.citations, expiresAt: enriched.expiresAt } }));
      used += text.length;
      if (output.length >= maxItems) break;
    }
    return Object.freeze(output);
  }

  #metadata(id) {
    const row = this.store.db.prepare('SELECT * FROM memory_sidecar_metadata WHERE memory_id=?').get(String(id));
    return row ? { ttlMs: row.ttl_ms == null ? null : Number(row.ttl_ms), expiresAt: row.expires_at == null ? null : Number(row.expires_at), createdCommit: row.created_commit, updatedBy: row.updated_by, metadataCreatedAt: Number(row.created_at), metadataUpdatedAt: Number(row.updated_at) } : { ttlMs: null, expiresAt: null, createdCommit: null, updatedBy: null, metadataCreatedAt: null, metadataUpdatedAt: null };
  }

  #citations(id) {
    return this.store.db.prepare('SELECT * FROM memory_citations WHERE memory_id=? ORDER BY ordinal').all(String(id)).map((row) => Object.freeze({ path: row.path, startLine: Number(row.start_line), endLine: Number(row.end_line), sha256: row.sha256, commit: row.commit_sha }));
  }

  #audit(id, action, actor, stamp) { this.store.db.prepare('INSERT INTO memory_sidecar_audit(memory_id,action,actor,created_at) VALUES(?,?,?,?)').run(String(id), String(action), String(actor), stamp); }

  async #stale(memory, reason) {
    let current = memory;
    if (memory.status === 'active') current = await this.memoryService.transition(memory.id, 'stale', { actor: `freshness:${reason}` });
    this.#audit(memory.id, `stale:${reason}`, 'memory-sidecar', Math.trunc(this.clock()));
    return Object.freeze({ fresh: false, reason, memory: this.get(current.id) });
  }
}
