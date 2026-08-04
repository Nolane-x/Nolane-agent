import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { ContextPlannerV2 } from '../agent/context-planner-v2.mjs';

const MEMORY_STATUSES = Object.freeze(['observed', 'candidate', 'approved', 'active', 'stale', 'revoked']);
const HASH = /^[a-f0-9]{64}$/i;
const required = (value, label) => { const text = String(value ?? '').trim(); if (!text) throw new TypeError(`${label} is required`); return text; };
const clip = (value, max = 500) => value == null ? null : String(value).slice(0, max);
const count = (value, fallback, max) => Math.max(1, Math.min(max, Number(value) || fallback));
const freeze = (value, seen = new WeakSet()) => { if (!value || typeof value !== 'object' || seen.has(value)) return value; seen.add(value); for (const child of Object.values(value)) freeze(child, seen); return Object.freeze(value); };

function artifactView(value = {}) {
  return freeze({ id: clip(value.id, 160), kind: clip(value.kind, 120), bytes: Number(value.bytes ?? 0), sha256: HASH.test(String(value.sha256 ?? '')) ? String(value.sha256) : null, preview: clip(value.preview, 1_000), createdAt: clip(value.createdAt, 80), refs: freeze({ projectId: clip(value.refs?.projectId, 200), taskId: clip(value.refs?.taskId, 200), runId: clip(value.refs?.runId, 200), missionId: clip(value.refs?.missionId, 200), sessionId: clip(value.refs?.sessionId, 200), historyKind: clip(value.refs?.historyKind, 120) }) });
}
function historyView(value = {}) { return freeze({ id: clip(value.id, 200), missionId: clip(value.missionId, 200), sessionId: clip(value.sessionId, 200), kind: clip(value.kind, 120), artifact: artifactView(value.artifact), itemCount: Number(value.itemCount ?? 0), createdAt: clip(value.createdAt, 80), receiptSha256: HASH.test(String(value.receiptSha256 ?? '')) ? String(value.receiptSha256) : null }); }
function citationView(value = {}) { return freeze({ path: clip(value.path, 500), startLine: Number(value.startLine ?? 1), endLine: Number(value.endLine ?? value.startLine ?? 1), sha256: HASH.test(String(value.sha256 ?? '')) ? String(value.sha256) : null, commit: clip(value.commit, 160) }); }
function memoryView(value = {}) { return freeze({ id: clip(value.id, 200), kind: clip(value.kind, 100), status: clip(value.status, 40), title: clip(value.title, 500), contentPreview: clip(value.content, 1_500), confidence: Number(value.confidence ?? 0), sourceTaskId: clip(value.sourceTaskId, 200), evidenceReceiptSha256: HASH.test(String(value.evidenceReceiptSha256 ?? '')) ? String(value.evidenceReceiptSha256) : null, createdAt: clip(value.createdAt, 80), updatedAt: clip(value.updatedAt, 80), ttlMs: value.ttlMs == null ? null : Number(value.ttlMs), expiresAt: value.expiresAt == null ? null : Number(value.expiresAt), createdCommit: clip(value.createdCommit, 160), updatedBy: clip(value.updatedBy, 200), citations: freeze((value.citations ?? []).slice(0, 64).map(citationView)) }); }
function pinView(row = {}) { return freeze({ artifactId: row.artifact_id, label: row.label, actor: row.actor, createdAt: row.created_at, receiptSha256: row.receipt_sha256 }); }

export class ContextMemoryCenterService {
  constructor({ version, store, historyArchive, contextStore, memoryService, memorySidecar, memoryOperatingSystem = null, planner = new ContextPlannerV2(), clock = () => new Date().toISOString(), limits = {} } = {}) {
    if (!store?.db || !store?.getProject) throw new TypeError('ContextMemoryCenterService store is required');
    if (!historyArchive?.list || !contextStore?.get) throw new TypeError('ContextMemoryCenterService context services are required');
    if (!memoryService?.list || !memorySidecar?.get || !memorySidecar?.verifyFreshness) throw new TypeError('ContextMemoryCenterService memory services are required');
    this.version = String(version ?? '0.0.0'); this.store = store; this.historyArchive = historyArchive; this.contextStore = contextStore; this.memoryService = memoryService; this.memorySidecar = memorySidecar; this.memoryOperatingSystem = memoryOperatingSystem; this.planner = planner; this.clock = clock;
    this.limits = Object.freeze({ history: count(limits.history, 300, 2_000), memories: count(limits.memories, 300, 2_000), pins: count(limits.pins, 300, 2_000) });
    this.store.db.exec(`CREATE TABLE IF NOT EXISTS context_artifact_pins(project_id TEXT NOT NULL,artifact_id TEXT NOT NULL,label TEXT NOT NULL,actor TEXT NOT NULL,created_at TEXT NOT NULL,receipt_sha256 TEXT NOT NULL,PRIMARY KEY(project_id,artifact_id)); CREATE INDEX IF NOT EXISTS context_artifact_pins_project ON context_artifact_pins(project_id,created_at);`);
  }

  #project(projectId) { const id = required(projectId, 'projectId'); if (!this.store.getProject(id)) throw Object.assign(new Error(`Unknown project: ${id}`), { statusCode: 404, code: 'PROJECT_NOT_FOUND' }); return id; }
  #principal(principalId) { return required(principalId, 'An authenticated principal'); }
  #pins(projectId) { return freeze(this.store.db.prepare('SELECT * FROM context_artifact_pins WHERE project_id=? ORDER BY created_at DESC,artifact_id LIMIT ?').all(projectId, this.limits.pins).map(pinView)); }

  async snapshot({ projectId, principalId, memoryStatuses = MEMORY_STATUSES } = {}) {
    const project = this.#project(projectId); const principal = this.#principal(principalId);
    const statuses = Array.isArray(memoryStatuses) ? memoryStatuses.map(String).filter((item) => MEMORY_STATUSES.includes(item)) : MEMORY_STATUSES;
    const history = freeze(this.historyArchive.list({ projectId: project, limit: this.limits.history }).map(historyView));
    const memories = freeze(this.memoryService.list(project, { statuses: statuses.length ? statuses : MEMORY_STATUSES, limit: this.limits.memories }).map((item) => memoryView(this.memorySidecar.get(item.id) ?? item)));
    const pins = this.#pins(project);
    const pinned = new Set(pins.map((item) => item.artifactId));
    const base = { schema: 'forge.context-memory-center.v1', version: this.version, projectId: project, principalId: principal, generatedAt: this.clock(), summary: freeze({ archives: history.length, artifactBytes: history.reduce((sum, item) => sum + item.artifact.bytes, 0), pinnedArtifacts: pins.length, memories: memories.length, activeMemories: memories.filter((item) => item.status === 'active').length, staleMemories: memories.filter((item) => item.status === 'stale').length, expiringMemories: memories.filter((item) => item.expiresAt != null).length }), budgets: freeze({ ...this.planner.budgets }), history: freeze(history.map((item) => freeze({ ...item, pinned: pinned.has(item.artifact.id) }))), memories, pins };
    return freeze({ ...base, receiptSha256: canonicalSha256(base) });
  }

  async pinArtifact({ projectId, artifactId, label = 'Pinned context artifact', principalId } = {}) {
    const project = this.#project(projectId); const principal = this.#principal(principalId); const id = required(artifactId, 'artifactId');
    const artifact = await this.contextStore.get(id);
    if (String(artifact.refs?.projectId ?? '') !== project) throw Object.assign(new Error('Context artifact project scope denied'), { statusCode: 403, code: 'CONTEXT_ARTIFACT_SCOPE_DENIED' });
    const createdAt = this.clock(); const safeLabel = required(label, 'label').slice(0, 500); const base = { schema: 'forge.context-artifact-pin.v1', projectId: project, artifactId: id, label: safeLabel, actor: principal, createdAt, artifactSha256: artifact.sha256 };
    const receiptSha256 = canonicalSha256(base);
    this.store.db.prepare('INSERT INTO context_artifact_pins(project_id,artifact_id,label,actor,created_at,receipt_sha256) VALUES(?,?,?,?,?,?) ON CONFLICT(project_id,artifact_id) DO UPDATE SET label=excluded.label,actor=excluded.actor,created_at=excluded.created_at,receipt_sha256=excluded.receipt_sha256').run(project, id, safeLabel, principal, createdAt, receiptSha256);
    return freeze({ ...base, pinned: true, receiptSha256 });
  }

  async unpinArtifact({ projectId, artifactId, principalId } = {}) {
    const project = this.#project(projectId); const principal = this.#principal(principalId); const id = required(artifactId, 'artifactId');
    const existing = this.store.db.prepare('SELECT * FROM context_artifact_pins WHERE project_id=? AND artifact_id=?').get(project, id);
    const removed = this.store.db.prepare('DELETE FROM context_artifact_pins WHERE project_id=? AND artifact_id=?').run(project, id).changes > 0;
    const base = { schema: 'forge.context-artifact-unpin.v1', projectId: project, artifactId: id, actor: principal, unpinned: removed, previousReceiptSha256: existing?.receipt_sha256 ?? null, createdAt: this.clock() };
    return freeze({ ...base, receiptSha256: canonicalSha256(base) });
  }

  async operateMemory({ projectId, memoryId, operation, principalId, ...input } = {}) {
    const project = this.#project(projectId); const principal = this.#principal(principalId);
    if (!this.memoryOperatingSystem?.apply) throw Object.assign(new Error('Memory Operating System is not available'), { statusCode: 503, code: 'MEMORY_OS_UNAVAILABLE' });
    return this.memoryOperatingSystem.apply({ ...input, projectId: project, memoryId: required(memoryId, 'memoryId'), operation: required(operation, 'operation'), actor: principal });
  }

  memoryVersions({ projectId, memoryId, principalId } = {}) {
    const project = this.#project(projectId); this.#principal(principalId);
    if (!this.memoryOperatingSystem?.versions) throw Object.assign(new Error('Memory Operating System is not available'), { statusCode: 503, code: 'MEMORY_OS_UNAVAILABLE' });
    const memory = this.memoryService.get(required(memoryId, 'memoryId'));
    if (!memory) throw Object.assign(new Error('Memory not found'), { statusCode: 404, code: 'MEMORY_NOT_FOUND' });
    if (memory.projectId !== project) throw Object.assign(new Error('Memory project scope denied'), { statusCode: 403, code: 'MEMORY_SCOPE_DENIED' });
    return this.memoryOperatingSystem.versions(memory.id);
  }

  async verifyMemory({ projectId, memoryId, principalId } = {}) {
    const project = this.#project(projectId); const principal = this.#principal(principalId); const id = required(memoryId, 'memoryId');
    const memory = this.memorySidecar.get(id);
    if (!memory) throw Object.assign(new Error('Memory not found'), { statusCode: 404, code: 'MEMORY_NOT_FOUND' });
    if (memory.projectId !== project) throw Object.assign(new Error('Memory project scope denied'), { statusCode: 403, code: 'MEMORY_SCOPE_DENIED' });
    const result = await this.memorySidecar.verifyFreshness(id);
    const base = { schema: 'forge.memory-freshness-check.v1', projectId: project, memoryId: id, actor: principal, fresh: result.fresh, reason: result.reason, status: result.memory?.status ?? memory.status, checkedAt: this.clock() };
    return freeze({ ...base, memory: memoryView(result.memory ?? memory), receiptSha256: canonicalSha256(base) });
  }
}
