import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const HASH = /^[a-f0-9]{64}$/i;
const STATUSES = new Set(['observed', 'candidate', 'approved', 'active', 'stale', 'revoked']);
const TRANSITIONS = new Map([
  ['observed', new Set(['candidate', 'revoked'])],
  ['candidate', new Set(['approved', 'revoked'])],
  ['approved', new Set(['active', 'revoked'])],
  ['active', new Set(['stale', 'revoked'])],
  ['stale', new Set(['candidate', 'revoked'])],
  ['revoked', new Set()],
]);

const now = () => new Date().toISOString();
const memoryId = () => `memory_${randomUUID().replaceAll('-', '').slice(0, 24)}`;
const safePart = (value) => String(value ?? '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100) || 'memory';

function boundedConfidence(value) {
  const number = Number(value ?? 0.5);
  if (!Number.isFinite(number) || number < 0 || number > 1) throw new TypeError('confidence must be between 0 and 1');
  return number;
}

function required(value, label) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`${label} is required`);
  return result;
}

function terms(query) {
  return [...new Set(String(query ?? '').toLowerCase().match(/[\p{L}\p{N}_-]{2,}/gu) ?? [])].slice(0, 16);
}

function markdown(record) {
  return `---\nid: ${JSON.stringify(record.id)}\nprojectId: ${JSON.stringify(record.projectId)}\nkind: ${JSON.stringify(record.kind)}\nstatus: ${JSON.stringify(record.status)}\nconfidence: ${record.confidence}\nsourceTaskId: ${JSON.stringify(record.sourceTaskId)}\nevidenceReceiptSha256: ${JSON.stringify(record.evidenceReceiptSha256)}\nactor: ${JSON.stringify(record.actor)}\ncreatedAt: ${JSON.stringify(record.createdAt)}\nupdatedAt: ${JSON.stringify(record.updatedAt)}\n---\n\n# ${record.title.replaceAll('\n', ' ')}\n\n${record.content}\n`;
}

export class MemoryService {
  constructor({ store, memoryRoot } = {}) {
    if (!store?.db || !memoryRoot) throw new TypeError('MemoryService store and memoryRoot are required');
    this.store = store;
    this.root = path.resolve(memoryRoot);
  }

  #row(row) {
    return row ? Object.freeze({
      id: row.id, projectId: row.project_id, kind: row.kind, status: row.status, title: row.title, content: row.content,
      confidence: Number(row.confidence), sourceTaskId: row.source_task_id, evidenceReceiptSha256: row.evidence_receipt_sha256,
      actor: row.actor, filePath: row.file_path, createdAt: row.created_at, updatedAt: row.updated_at,
    }) : null;
  }

  get(id) { return this.#row(this.store.db.prepare('SELECT * FROM memory_items WHERE id=?').get(String(id))); }

  async #write(record) {
    await mkdir(path.dirname(record.filePath), { recursive: true });
    const temporary = `${record.filePath}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporary, markdown(record), { encoding: 'utf8', flag: 'wx' });
    await rename(temporary, record.filePath);
  }

  #index(record) {
    this.store.db.prepare('DELETE FROM memory_fts WHERE id=?').run(record.id);
    this.store.db.prepare('INSERT INTO memory_fts(id,project_id,title,content) VALUES(?,?,?,?)').run(record.id, record.projectId, record.title, record.content);
  }

  async observe({ projectId, title, content, kind = 'episodic', confidence = 0.5, sourceTaskId = null, evidenceReceiptSha256 = null, actor = 'agent' } = {}) {
    if (!this.store.getProject(projectId)) throw new Error(`Unknown project: ${projectId}`);
    if (evidenceReceiptSha256 != null && !HASH.test(String(evidenceReceiptSha256))) throw new TypeError('evidenceReceiptSha256 must be a SHA-256 hash');
    const stamp = now(); const id = memoryId();
    const record = {
      id, projectId, kind: required(kind, 'memory kind'), status: 'observed', title: required(title, 'memory title'), content: required(content, 'memory content'),
      confidence: boundedConfidence(confidence), sourceTaskId: sourceTaskId == null ? null : String(sourceTaskId), evidenceReceiptSha256: evidenceReceiptSha256 == null ? null : String(evidenceReceiptSha256),
      actor: String(actor), filePath: path.join(this.root, safePart(projectId), `${safePart(id)}.md`), createdAt: stamp, updatedAt: stamp,
    };
    await this.#write(record);
    this.store.transaction(() => {
      this.store.db.prepare(`INSERT INTO memory_items(id,project_id,kind,status,title,content,confidence,source_task_id,evidence_receipt_sha256,actor,file_path,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(record.id, record.projectId, record.kind, record.status, record.title, record.content, record.confidence, record.sourceTaskId, record.evidenceReceiptSha256, record.actor, record.filePath, stamp, stamp);
      this.#index(record);
    });
    return Object.freeze(record);
  }

  async update(id, { title, content, confidence, actor = 'operator' } = {}) {
    const current = this.get(id);
    if (!current) throw new Error(`Unknown memory: ${id}`);
    if (current.status === 'revoked') throw new Error('Revoked memory cannot be edited');
    const record = {
      ...current,
      title: title === undefined ? current.title : required(title, 'memory title'),
      content: content === undefined ? current.content : required(content, 'memory content'),
      confidence: confidence === undefined ? current.confidence : boundedConfidence(confidence),
      actor: String(actor),
      updatedAt: now(),
    };
    await this.#write(record);
    this.store.transaction(() => {
      this.store.db.prepare('UPDATE memory_items SET title=?,content=?,confidence=?,actor=?,updated_at=? WHERE id=?').run(record.title, record.content, record.confidence, record.actor, record.updatedAt, record.id);
      this.#index(record);
    });
    return Object.freeze(record);
  }

  async purge(id, { actor = 'operator' } = {}) {
    const current = this.get(id);
    if (!current) return false;
    if (current.status !== 'revoked') throw new Error('Memory must be revoked before permanent purge');
    this.store.transaction(() => {
      this.store.db.prepare('DELETE FROM memory_fts WHERE id=?').run(current.id);
      this.store.db.prepare('DELETE FROM memory_items WHERE id=?').run(current.id);
    });
    await rm(current.filePath, { force: true });
    return Object.freeze({ id: current.id, purged: true, actor: String(actor), purgedAt: now() });
  }

  async transition(id, nextStatus, { actor = 'operator', evidenceReceiptSha256 = null } = {}) {
    const current = this.get(id);
    if (!current) throw new Error(`Unknown memory: ${id}`);
    const next = String(nextStatus);
    if (!STATUSES.has(next) || !TRANSITIONS.get(current.status)?.has(next)) throw new Error(`Illegal memory transition: ${current.status} -> ${next}`);
    const evidence = evidenceReceiptSha256 ?? current.evidenceReceiptSha256;
    if (['approved', 'active'].includes(next) && !HASH.test(String(evidence ?? ''))) throw new Error(`${next} memory requires evidence receipt SHA-256`);
    const record = { ...current, status: next, evidenceReceiptSha256: evidence ?? null, actor: String(actor), updatedAt: now() };
    await this.#write(record);
    this.store.transaction(() => {
      this.store.db.prepare('UPDATE memory_items SET status=?,evidence_receipt_sha256=?,actor=?,updated_at=? WHERE id=?').run(record.status, record.evidenceReceiptSha256, record.actor, record.updatedAt, record.id);
      this.#index(record);
    });
    return Object.freeze(record);
  }

  list(projectId, { statuses = null, limit = 200 } = {}) {
    const safeLimit = Math.max(1, Math.min(2_000, Number(limit) || 200));
    const selected = statuses == null ? null : statuses.map(String);
    if (selected?.some((status) => !STATUSES.has(status))) throw new TypeError('Unknown memory status');
    const placeholders = selected?.length ? ` AND status IN (${selected.map(() => '?').join(',')})` : '';
    return this.store.db.prepare(`SELECT * FROM memory_items WHERE project_id=?${placeholders} ORDER BY updated_at DESC,id LIMIT ?`).all(projectId, ...(selected ?? []), safeLimit).map((row) => this.#row(row));
  }

  search(projectId, query, { statuses = ['active'], limit = 20 } = {}) {
    const selected = statuses.map(String);
    if (!selected.length || selected.some((status) => !STATUSES.has(status))) throw new TypeError('Memory search statuses are invalid');
    const needles = terms(query);
    if (!needles.length) return this.list(projectId, { statuses: selected, limit });
    const placeholders = selected.map(() => '?').join(',');
    const match = needles.map((term) => `"${term.replaceAll('"', '""')}"*`).join(' OR ');
    let rows;
    try {
      rows = this.store.db.prepare(`SELECT m.*,bm25(memory_fts) AS rank FROM memory_fts JOIN memory_items m ON m.id=memory_fts.id
        WHERE memory_fts.project_id=? AND memory_fts MATCH ? AND m.status IN (${placeholders}) ORDER BY rank,m.updated_at DESC LIMIT ?`).all(projectId, match, ...selected, Math.max(1, Math.min(200, Number(limit) || 20)));
    } catch {
      const likes = needles.map(() => '(LOWER(title) LIKE ? OR LOWER(content) LIKE ?)').join(' OR ');
      const values = needles.flatMap((term) => [`%${term}%`, `%${term}%`]);
      rows = this.store.db.prepare(`SELECT * FROM memory_items WHERE project_id=? AND status IN (${placeholders}) AND (${likes}) ORDER BY updated_at DESC LIMIT ?`).all(projectId, ...selected, ...values, Math.max(1, Math.min(200, Number(limit) || 20)));
    }
    return rows.map((row) => this.#row(row));
  }

  context(projectId, query, { maxItems = 8, maxChars = 12_000 } = {}) {
    const output = []; let used = 0;
    for (const item of this.search(projectId, query, { statuses: ['active'], limit: maxItems * 2 })) {
      const text = `[approved-project-memory]\nTitle: ${item.title}\nConfidence: ${item.confidence}\nEvidence: ${item.evidenceReceiptSha256}\n${item.content}`;
      if (used + text.length > maxChars) continue;
      output.push(Object.freeze({ id: `memory:${item.id}`, text, sha256: item.evidenceReceiptSha256, priority: Math.round(item.confidence * 1_000), metadata: { memoryId: item.id, kind: item.kind, status: item.status } }));
      used += text.length;
      if (output.length >= maxItems) break;
    }
    return Object.freeze(output);
  }
}
