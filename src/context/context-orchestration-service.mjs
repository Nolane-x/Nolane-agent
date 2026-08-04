import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { ContextOrchestrationKernel } from '../agent/context-orchestration-kernel.mjs';

const required = (value, label) => { const text = String(value ?? '').trim(); if (!text) throw new TypeError(`${label} is required`); return text; };
const clamp = (value, fallback = 100, max = 1_000) => { const number = value == null ? fallback : Number(value); if (!Number.isInteger(number) || number < 1 || number > max) throw new TypeError(`limit must be between 1 and ${max}`); return number; };
const encodeCursor = (offset) => Buffer.from(JSON.stringify({ offset }), 'utf8').toString('base64url');
function decodeCursor(value) {
  if (!value) return 0;
  try { const parsed = JSON.parse(Buffer.from(String(value), 'base64url').toString('utf8')); if (!Number.isInteger(parsed.offset) || parsed.offset < 0) throw new Error(); return parsed.offset; }
  catch { throw Object.assign(new Error('Invalid checkpoint cursor'), { statusCode: 400, code: 'INVALID_CONTEXT_CURSOR' }); }
}
function freeze(value, seen = new WeakSet()) { if (!value || typeof value !== 'object' || seen.has(value)) return value; seen.add(value); for (const child of Object.values(value)) freeze(child, seen); return Object.freeze(value); }
function rowView(row) { return freeze({ id: row.id, projectId: row.project_id, principalId: row.principal_id, label: row.label, role: row.role, plan: JSON.parse(row.plan_json), createdAt: row.created_at, receiptSha256: row.receipt_sha256 }); }

export class ContextOrchestrationService {
  constructor({ file, kernel = new ContextOrchestrationKernel(), clock = () => new Date().toISOString() } = {}) {
    if (!file) throw new TypeError('ContextOrchestrationService file is required');
    if (!kernel?.plan) throw new TypeError('ContextOrchestrationService kernel is required');
    this.file = path.resolve(file); this.kernel = kernel; this.clock = clock;
    this.db = new DatabaseSync(this.file);
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS context_orchestration_checkpoints(
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        principal_id TEXT NOT NULL,
        label TEXT NOT NULL,
        role TEXT NOT NULL,
        plan_receipt_sha256 TEXT NOT NULL,
        plan_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        receipt_sha256 TEXT NOT NULL UNIQUE,
        UNIQUE(project_id,principal_id,plan_receipt_sha256,label)
      );
      CREATE INDEX IF NOT EXISTS context_orchestration_scope ON context_orchestration_checkpoints(project_id,principal_id,created_at,id);
    `);
  }

  plan(input) { return this.kernel.plan(input); }

  checkpoint({ projectId, principalId, plan, label = 'Context checkpoint' } = {}) {
    const project = required(projectId, 'projectId'); const principal = required(principalId, 'principalId');
    if (!plan?.receiptSha256 || !Array.isArray(plan.items)) throw new TypeError('A context orchestration plan is required');
    if (plan.projectId !== project || plan.principalId !== principal) throw Object.assign(new Error('Context checkpoint scope denied'), { statusCode: 403, code: 'CONTEXT_CHECKPOINT_SCOPE_DENIED' });
    const safeLabel = required(label, 'label').slice(0, 500);
    const existing = this.db.prepare('SELECT * FROM context_orchestration_checkpoints WHERE project_id=? AND principal_id=? AND plan_receipt_sha256=? AND label=?').get(project, principal, plan.receiptSha256, safeLabel);
    if (existing) return rowView(existing);
    const createdAt = this.clock();
    const id = `ctxcp_${canonicalSha256({ project, principal, plan: plan.receiptSha256, label: safeLabel }).slice(0, 24)}`;
    const base = { schema: 'forge.context-orchestration-checkpoint.v1', id, projectId: project, principalId: principal, label: safeLabel, role: plan.role, planReceiptSha256: plan.receiptSha256, itemDigests: plan.items.map((item) => canonicalSha256(item)), createdAt };
    const receiptSha256 = canonicalSha256(base);
    this.db.prepare('INSERT INTO context_orchestration_checkpoints(id,project_id,principal_id,label,role,plan_receipt_sha256,plan_json,created_at,receipt_sha256) VALUES(?,?,?,?,?,?,?,?,?)').run(id, project, principal, safeLabel, plan.role, plan.receiptSha256, JSON.stringify(plan), createdAt, receiptSha256);
    return this.getCheckpoint(id, { projectId: project, principalId: principal });
  }

  getCheckpoint(checkpointId, { projectId, principalId } = {}) {
    const id = required(checkpointId, 'checkpointId');
    const row = this.db.prepare('SELECT * FROM context_orchestration_checkpoints WHERE id=?').get(id);
    if (!row) throw Object.assign(new Error('Context checkpoint not found'), { statusCode: 404, code: 'CONTEXT_CHECKPOINT_NOT_FOUND' });
    if (row.project_id !== required(projectId, 'projectId') || row.principal_id !== required(principalId, 'principalId')) throw Object.assign(new Error('Context checkpoint scope denied'), { statusCode: 403, code: 'CONTEXT_CHECKPOINT_SCOPE_DENIED' });
    return rowView(row);
  }

  pageCheckpoint(checkpointId, { projectId, principalId, cursor = null, limit = 100 } = {}) {
    const checkpoint = this.getCheckpoint(checkpointId, { projectId, principalId });
    const offset = decodeCursor(cursor); const pageSize = clamp(limit);
    const items = checkpoint.plan.items.slice(offset, offset + pageSize);
    const nextOffset = offset + items.length;
    const nextCursor = nextOffset < checkpoint.plan.items.length ? encodeCursor(nextOffset) : null;
    const base = { schema: 'forge.context-orchestration-checkpoint-page.v1', checkpointId: checkpoint.id, projectId: checkpoint.projectId, principalId: checkpoint.principalId, offset, limit: pageSize, itemDigests: items.map((item) => canonicalSha256(item)), nextCursor };
    return freeze({ ...base, items: freeze(structuredClone(items)), totalItems: checkpoint.plan.items.length, receiptSha256: canonicalSha256(base) });
  }

  close() { this.db.close(); }
}
