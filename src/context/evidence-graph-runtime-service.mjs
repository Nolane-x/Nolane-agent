import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { redactSecrets } from '../security/redaction.mjs';

const NODE_TYPES = new Set(['Requirement', 'File', 'Symbol', 'Function', 'Class', 'Test', 'Error', 'Command', 'Decision', 'Patch', 'ToolOutput', 'Memory', 'Hypothesis', 'Dependency', 'Document']);
const EDGE_TYPES = new Set(['imports', 'calls', 'defines', 'implements', 'tested_by', 'failed_with', 'changed_by', 'depends_on', 'contradicts', 'supersedes', 'proves', 'supports', 'refutes']);
const INVALIDATION_KINDS = new Set(['file_changed', 'test_rerun', 'plan_revised', 'dependency_updated', 'requirement_changed']);
const HASH = /^[a-f0-9]{64}$/i;

function required(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${label} is required`);
  return text;
}
function confidence(value, fallback = 0.5) {
  const number = value == null ? fallback : Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) throw new TypeError('confidence must be between 0 and 1');
  return number;
}
function boundedArray(value, label, max, { min = 0 } = {}) {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
  if (value.length < min || value.length > max) throw new TypeError(`${label} must contain between ${min} and ${max} items`);
  return value;
}
function freeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) freeze(child, seen);
  return Object.freeze(value);
}
function publicJson(value, maxBytes = 128_000) {
  const serialized = JSON.stringify(value ?? {});
  if (Buffer.byteLength(serialized) > maxBytes) throw new TypeError(`evidence content exceeds ${maxBytes} bytes`);
  return JSON.parse(redactSecrets(serialized));
}
function nodeView(row) {
  return freeze({
    id: row.id,
    projectId: row.project_id,
    principalId: row.principal_id,
    type: row.type,
    label: row.label,
    content: JSON.parse(row.content_json),
    sourceKind: row.source_kind,
    sourceRef: row.source_ref,
    sourceHash: row.source_hash,
    version: row.source_version,
    validUntil: row.valid_until,
    createdBy: row.created_by,
    confidence: Number(row.confidence),
    status: row.status,
    staleReason: row.stale_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    receiptSha256: row.receipt_sha256,
  });
}
function edgeView(row) {
  return freeze({
    id: row.id,
    projectId: row.project_id,
    principalId: row.principal_id,
    from: row.from_id,
    to: row.to_id,
    type: row.type,
    metadata: JSON.parse(row.metadata_json),
    confidence: Number(row.confidence),
    status: row.status,
    staleReason: row.stale_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    receiptSha256: row.receipt_sha256,
  });
}
function validateSubagentShape(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new TypeError('subagent result must be an object');
  const task = required(result.task, 'task');
  const findings = boundedArray(result.findings, 'findings', 200);
  const evidence = boundedArray(result.evidence, 'evidence', 200, { min: 1 }).map(String);
  const filesExamined = boundedArray(result.filesExamined, 'filesExamined', 500).map(String);
  const hypothesesRejected = boundedArray(result.hypothesesRejected, 'hypothesesRejected', 200).map(String);
  const remainingUncertainty = boundedArray(result.remainingUncertainty, 'remainingUncertainty', 200).map(String);
  const recommendedNextAction = required(result.recommendedNextAction, 'recommendedNextAction');
  return publicJson({ task, findings: findings.map(String), evidence, filesExamined, hypothesesRejected, remainingUncertainty, recommendedNextAction }, 256_000);
}

export class EvidenceGraphRuntimeService {
  constructor({ version = '0.0.0', file, projectResolver, contextStore = null, memorySidecar = null, clock = () => new Date().toISOString(), limits = {} } = {}) {
    if (!file) throw new TypeError('EvidenceGraphRuntimeService file is required');
    if (typeof projectResolver !== 'function') throw new TypeError('EvidenceGraphRuntimeService projectResolver is required');
    this.version = String(version);
    this.file = path.resolve(file);
    this.projectResolver = projectResolver;
    this.contextStore = contextStore;
    this.memorySidecar = memorySidecar;
    this.clock = clock;
    this.limits = Object.freeze({
      nodesPerWrite: Math.max(1, Math.min(2_000, Number(limits.nodesPerWrite) || 500)),
      edgesPerWrite: Math.max(1, Math.min(4_000, Number(limits.edgesPerWrite) || 1_000)),
      graphNodes: Math.max(1, Math.min(20_000, Number(limits.graphNodes) || 5_000)),
      graphEdges: Math.max(1, Math.min(50_000, Number(limits.graphEdges) || 10_000)),
    });
    this.db = new DatabaseSync(this.file);
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA busy_timeout=5000;
      PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS evidence_graph_nodes(
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        principal_id TEXT NOT NULL,
        type TEXT NOT NULL,
        label TEXT NOT NULL,
        content_json TEXT NOT NULL,
        source_kind TEXT NOT NULL,
        source_ref TEXT NOT NULL,
        source_hash TEXT NOT NULL,
        source_version TEXT NOT NULL,
        valid_until TEXT NOT NULL,
        created_by TEXT NOT NULL,
        confidence REAL NOT NULL,
        status TEXT NOT NULL,
        stale_reason TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        receipt_sha256 TEXT NOT NULL UNIQUE
      );
      CREATE INDEX IF NOT EXISTS evidence_graph_nodes_scope ON evidence_graph_nodes(project_id,status,type,source_kind,source_ref);
      CREATE TABLE IF NOT EXISTS evidence_graph_edges(
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        principal_id TEXT NOT NULL,
        from_id TEXT NOT NULL REFERENCES evidence_graph_nodes(id),
        to_id TEXT NOT NULL REFERENCES evidence_graph_nodes(id),
        type TEXT NOT NULL,
        metadata_json TEXT NOT NULL,
        confidence REAL NOT NULL,
        status TEXT NOT NULL,
        stale_reason TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        receipt_sha256 TEXT NOT NULL UNIQUE
      );
      CREATE INDEX IF NOT EXISTS evidence_graph_edges_scope ON evidence_graph_edges(project_id,status,type,from_id,to_id);
      CREATE TABLE IF NOT EXISTS evidence_graph_audit(
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL,
        principal_id TEXT NOT NULL,
        action TEXT NOT NULL,
        detail_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        receipt_sha256 TEXT NOT NULL UNIQUE
      );
    `);
  }

  #scope({ projectId, principalId } = {}) {
    const project = required(projectId, 'projectId');
    const principal = required(principalId, 'principalId');
    if (!this.projectResolver(project)) throw Object.assign(new Error(`Unknown project: ${project}`), { statusCode: 404, code: 'EVIDENCE_PROJECT_NOT_FOUND' });
    return { projectId: project, principalId: principal };
  }

  #audit(scope, action, detail) {
    const createdAt = this.clock();
    const safeDetail = publicJson(detail, 256_000);
    const base = { schema: 'forge.evidence-graph-audit.v1', version: this.version, ...scope, action, detail: safeDetail, createdAt };
    const receiptSha256 = canonicalSha256(base);
    this.db.prepare('INSERT OR IGNORE INTO evidence_graph_audit(project_id,principal_id,action,detail_json,created_at,receipt_sha256) VALUES(?,?,?,?,?,?)')
      .run(scope.projectId, scope.principalId, action, JSON.stringify(safeDetail), createdAt, receiptSha256);
    return freeze({ ...base, receiptSha256 });
  }

  #getNodes(ids, projectId, { activeOnly = false } = {}) {
    if (!ids.length) return [];
    const placeholders = ids.map(() => '?').join(',');
    const rows = this.db.prepare(`SELECT * FROM evidence_graph_nodes WHERE project_id=? AND id IN (${placeholders})${activeOnly ? " AND status='active'" : ''}`).all(projectId, ...ids);
    const byId = new Map(rows.map((row) => [row.id, nodeView(row)]));
    return ids.map((id) => byId.get(id)).filter(Boolean);
  }

  index(input = {}) {
    const scope = this.#scope(input);
    const inputs = boundedArray(input.nodes ?? [], 'nodes', this.limits.nodesPerWrite);
    const edgeInputs = boundedArray(input.edges ?? [], 'edges', this.limits.edgesPerWrite);
    const stamp = this.clock();
    const keyToId = new Map();
    const nodeIds = [];
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const insertNode = this.db.prepare(`INSERT OR IGNORE INTO evidence_graph_nodes(id,project_id,principal_id,type,label,content_json,source_kind,source_ref,source_hash,source_version,valid_until,created_by,confidence,status,stale_reason,created_at,updated_at,receipt_sha256) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'active',NULL,?,?,?)`);
      for (const raw of inputs) {
        const type = required(raw.type, 'node type');
        if (!NODE_TYPES.has(type)) throw new TypeError(`Unsupported node type: ${type}`);
        const label = required(raw.label, 'node label').slice(0, 1_000);
        const sourceKind = required(raw.sourceKind, 'sourceKind').slice(0, 120);
        const sourceRef = required(raw.sourceRef, 'sourceRef').slice(0, 4_096);
        const sourceHash = required(raw.sourceHash, 'sourceHash').toLowerCase();
        if (!HASH.test(sourceHash)) throw new TypeError('sourceHash must be a SHA-256 hash');
        const sourceVersion = required(raw.version ?? '1', 'version').slice(0, 512);
        const validUntil = required(raw.validUntil ?? 'source_changed', 'validUntil').slice(0, 120);
        const createdBy = String(raw.createdBy ?? scope.principalId).slice(0, 500);
        const safeContent = publicJson(raw.content ?? {}, 256_000);
        const nodeBase = { schema: 'forge.evidence-node.v1', version: this.version, projectId: scope.projectId, type, label, content: safeContent, sourceKind, sourceRef, sourceHash, sourceVersion, validUntil, createdBy, confidence: confidence(raw.confidence), status: 'active' };
        const id = `evn_${canonicalSha256(nodeBase).slice(0, 32)}`;
        const receiptSha256 = canonicalSha256({ ...nodeBase, id });
        insertNode.run(id, scope.projectId, scope.principalId, type, label, JSON.stringify(safeContent), sourceKind, sourceRef, sourceHash, sourceVersion, validUntil, createdBy, nodeBase.confidence, stamp, stamp, receiptSha256);
        nodeIds.push(id);
        if (raw.key != null) keyToId.set(String(raw.key), id);
        keyToId.set(id, id);
      }
      const insertEdge = this.db.prepare(`INSERT OR IGNORE INTO evidence_graph_edges(id,project_id,principal_id,from_id,to_id,type,metadata_json,confidence,status,stale_reason,created_at,updated_at,receipt_sha256) VALUES(?,?,?,?,?,?,?,?,'active',NULL,?,?,?)`);
      const edgeIds = [];
      for (const raw of edgeInputs) {
        const type = required(raw.type, 'edge type');
        if (!EDGE_TYPES.has(type)) throw new TypeError(`Unsupported edge type: ${type}`);
        const from = keyToId.get(String(raw.from)) ?? String(raw.from ?? '');
        const to = keyToId.get(String(raw.to)) ?? String(raw.to ?? '');
        const resolved = this.#getNodes([from, to], scope.projectId, { activeOnly: true });
        if (resolved.length !== 2) throw new Error(`Edge ${type} requires two active project-scoped nodes`);
        const metadata = publicJson(raw.metadata ?? {}, 128_000);
        const edgeBase = { schema: 'forge.evidence-edge.v1', version: this.version, projectId: scope.projectId, from, to, type, metadata, confidence: confidence(raw.confidence) };
        const id = `eve_${canonicalSha256(edgeBase).slice(0, 32)}`;
        const receiptSha256 = canonicalSha256({ ...edgeBase, id });
        insertEdge.run(id, scope.projectId, scope.principalId, from, to, type, JSON.stringify(metadata), edgeBase.confidence, stamp, stamp, receiptSha256);
        edgeIds.push(id);
      }
      this.db.exec('COMMIT');
      const nodes = this.#getNodes(nodeIds, scope.projectId);
      const edges = edgeIds.length ? this.db.prepare(`SELECT * FROM evidence_graph_edges WHERE project_id=? AND id IN (${edgeIds.map(() => '?').join(',')}) ORDER BY id`).all(scope.projectId, ...edgeIds).map(edgeView) : [];
      const base = { schema: 'forge.evidence-graph-index.v1', version: this.version, ...scope, nodes, edges, indexedAt: stamp };
      const result = freeze({ ...base, receiptSha256: canonicalSha256(base) });
      this.#audit(scope, 'index', { nodeIds: nodes.map((node) => node.id), edgeIds: edges.map((edge) => edge.id), indexReceiptSha256: result.receiptSha256 });
      return result;
    } catch (error) {
      try { this.db.exec('ROLLBACK'); } catch { /* transaction already closed */ }
      throw error;
    }
  }

  connect(input = {}) {
    const scope = this.#scope(input);
    return this.index({ ...scope, nodes: [], edges: input.edges ?? [] });
  }

  graph(input = {}) {
    const scope = this.#scope(input);
    const includeStale = input.includeStale === true;
    const nodeLimit = Math.max(1, Math.min(this.limits.graphNodes, Number(input.nodeLimit) || this.limits.graphNodes));
    const edgeLimit = Math.max(1, Math.min(this.limits.graphEdges, Number(input.edgeLimit) || this.limits.graphEdges));
    const statusClause = includeStale ? '' : " AND status='active'";
    const nodes = this.db.prepare(`SELECT * FROM evidence_graph_nodes WHERE project_id=?${statusClause} ORDER BY created_at,id LIMIT ?`).all(scope.projectId, nodeLimit).map(nodeView);
    const nodeSet = new Set(nodes.map((node) => node.id));
    const edges = this.db.prepare(`SELECT * FROM evidence_graph_edges WHERE project_id=?${statusClause} ORDER BY created_at,id LIMIT ?`).all(scope.projectId, edgeLimit * 2).map(edgeView).filter((edge) => nodeSet.has(edge.from) && nodeSet.has(edge.to)).slice(0, edgeLimit);
    const base = { schema: 'forge.evidence-graph.v1', version: this.version, ...scope, includeStale, nodes, edges, generatedAt: this.clock() };
    return freeze({ ...base, receiptSha256: canonicalSha256(base) });
  }

  #activeEvidence(scope, ids) {
    const unique = [...new Set(ids.map(String))];
    const nodes = this.#getNodes(unique, scope.projectId, { activeOnly: true });
    if (nodes.length !== unique.length) throw new Error('All evidence references must resolve to active evidence nodes');
    return nodes;
  }

  invalidate(input = {}) {
    const scope = this.#scope(input);
    const kind = required(input.kind, 'invalidation kind');
    if (!INVALIDATION_KINDS.has(kind)) throw new TypeError(`Unsupported invalidation kind: ${kind}`);
    const target = required(input.target, 'target');
    const stamp = this.clock();
    let rows;
    if (kind === 'file_changed') {
      const currentHash = required(input.currentHash, 'currentHash').toLowerCase();
      if (!HASH.test(currentHash)) throw new TypeError('currentHash must be a SHA-256 hash');
      rows = this.db.prepare("SELECT id FROM evidence_graph_nodes WHERE project_id=? AND status='active' AND source_kind='file' AND source_ref=? AND source_hash<>?").all(scope.projectId, target, currentHash);
    } else if (kind === 'test_rerun') {
      const currentVersion = required(input.currentVersion, 'currentVersion');
      rows = this.db.prepare("SELECT id FROM evidence_graph_nodes WHERE project_id=? AND status='active' AND source_kind='test' AND source_ref=? AND source_version<>?").all(scope.projectId, target, currentVersion);
    } else if (kind === 'plan_revised') {
      rows = this.db.prepare("SELECT id FROM evidence_graph_nodes WHERE project_id=? AND status='active' AND type='Hypothesis' AND source_kind='plan' AND source_ref<>?").all(scope.projectId, target);
    } else if (kind === 'dependency_updated') {
      const currentVersion = required(input.currentVersion, 'currentVersion');
      rows = this.db.prepare("SELECT id FROM evidence_graph_nodes WHERE project_id=? AND status='active' AND source_kind='dependency' AND source_ref=? AND source_version<>?").all(scope.projectId, target, currentVersion);
    } else {
      rows = this.db.prepare("SELECT id FROM evidence_graph_nodes WHERE project_id=? AND status='active' AND source_kind='requirement' AND source_ref=?").all(scope.projectId, target);
    }
    const ids = rows.map((row) => row.id);
    if (ids.length) {
      const placeholders = ids.map(() => '?').join(',');
      this.db.exec('BEGIN IMMEDIATE');
      try {
        this.db.prepare(`UPDATE evidence_graph_nodes SET status='stale',stale_reason=?,updated_at=? WHERE id IN (${placeholders})`).run(kind, stamp, ...ids);
        this.db.prepare(`UPDATE evidence_graph_edges SET status='stale',stale_reason=?,updated_at=? WHERE status='active' AND (from_id IN (${placeholders}) OR to_id IN (${placeholders}))`).run(kind, stamp, ...ids, ...ids);
        this.db.exec('COMMIT');
      } catch (error) { try { this.db.exec('ROLLBACK'); } catch {} throw error; }
    }
    const base = { schema: 'forge.evidence-invalidation.v1', version: this.version, ...scope, kind, target, invalidated: ids.length, nodeIds: ids, invalidatedAt: stamp };
    const result = freeze({ ...base, receiptSha256: canonicalSha256(base) });
    this.#audit(scope, 'invalidate', result);
    return result;
  }

  async compact(input = {}) {
    const scope = this.#scope(input);
    if (!this.contextStore?.artifactize) throw new Error('Context artifact store is not configured');
    const fullContent = required(input.fullContent, 'fullContent');
    if (Buffer.byteLength(fullContent) > 50_000_000) throw new TypeError('fullContent exceeds compaction limit');
    const summary = required(input.summary, 'summary').slice(0, 40_000);
    const unresolved = boundedArray(input.unresolved ?? [], 'unresolved', 200).map((value) => String(value).slice(0, 4_000));
    const evidenceNodes = this.#activeEvidence(scope, boundedArray(input.evidenceNodeIds ?? [], 'evidenceNodeIds', 500, { min: 1 }));
    const sourceRef = required(input.sourceRef, 'sourceRef');
    const sourceHash = required(input.sourceHash, 'sourceHash').toLowerCase();
    if (!HASH.test(sourceHash)) throw new TypeError('sourceHash must be a SHA-256 hash');
    const artifact = await this.contextStore.artifactize({ kind: 'evidence-context-compaction', content: fullContent, metadata: { summary, unresolved, evidenceNodeIds: evidenceNodes.map((node) => node.id) } }, { projectId: scope.projectId, taskId: 'context-runtime', runId: sourceRef, refs: { projectId: scope.projectId, principalId: scope.principalId, sourceRef } });
    const indexed = this.index({
      ...scope,
      nodes: [{ key: 'summary', type: input.kind === 'tool-output' ? 'ToolOutput' : 'Decision', label: String(input.label ?? 'Lossless context compaction'), content: { summary, unresolved, artifactId: artifact.id, artifactSha256: artifact.sha256, evidenceNodeIds: evidenceNodes.map((node) => node.id) }, sourceKind: 'compaction', sourceRef, sourceHash, version: String(input.version ?? '1'), validUntil: String(input.validUntil ?? 'source_changed'), confidence: confidence(input.confidence, 0.9) }],
      edges: evidenceNodes.map((node) => ({ from: 'summary', to: node.id, type: 'depends_on', confidence: 1, metadata: { artifactId: artifact.id } })),
    });
    const base = { schema: 'forge.lossless-context-compaction.v1', version: this.version, ...scope, artifact, node: indexed.nodes[0], edges: indexed.edges, compactedAt: this.clock() };
    return freeze({ ...base, receiptSha256: canonicalSha256(base) });
  }

  async proposeMemory(input = {}) {
    const scope = this.#scope(input);
    if (!this.memorySidecar?.propose) throw new Error('Project memory sidecar is not configured');
    const evidenceNodes = this.#activeEvidence(scope, boundedArray(input.evidenceNodeIds ?? [], 'evidenceNodeIds', 200, { min: 1 }));
    const evidenceReceipt = canonicalSha256({ projectId: scope.projectId, nodeReceipts: evidenceNodes.map((node) => node.receiptSha256).sort() });
    const memory = await this.memorySidecar.propose({
      projectId: scope.projectId,
      title: required(input.title, 'title'),
      content: required(input.content, 'content'),
      kind: String(input.kind ?? 'episodic'),
      confidence: confidence(input.confidence, 0.7),
      sourceTaskId: input.sourceTaskId == null ? null : String(input.sourceTaskId),
      citations: boundedArray(input.citations ?? [], 'citations', 200),
      ttlMs: input.ttlMs ?? null,
      createdCommit: `evidence:${evidenceReceipt}`,
      actor: scope.principalId,
    });
    const indexed = this.index({ ...scope, nodes: [{ key: 'memory', type: 'Memory', label: memory.title ?? input.title, content: { memoryId: memory.id, status: memory.status, evidenceNodeIds: evidenceNodes.map((node) => node.id) }, sourceKind: 'memory', sourceRef: memory.id, sourceHash: evidenceReceipt, version: String(memory.metadataUpdatedAt ?? memory.updatedAt ?? '1'), validUntil: 'evidence_changed', confidence: confidence(input.confidence, 0.7) }], edges: evidenceNodes.map((node) => ({ from: node.id, to: 'memory', type: 'proves', confidence: 1 })) });
    const base = { schema: 'forge.evidence-backed-memory-proposal.v1', version: this.version, ...scope, status: memory.status, memory, graphNode: indexed.nodes[0], evidenceNodeIds: evidenceNodes.map((node) => node.id), evidenceReceiptSha256: evidenceReceipt };
    return freeze({ ...base, receiptSha256: canonicalSha256(base) });
  }

  validateSubagentResult(input = {}) {
    const scope = this.#scope(input);
    const result = validateSubagentShape(input.result);
    this.#activeEvidence(scope, result.evidence);
    const base = { schema: 'forge.structured-subagent-result.v1', version: this.version, ...scope, result, validatedAt: this.clock() };
    const output = freeze({ ...base, receiptSha256: canonicalSha256(base) });
    this.#audit(scope, 'subagent-result-validated', { receiptSha256: output.receiptSha256, evidence: result.evidence, task: result.task });
    return output;
  }

  close() { this.db.close(); }
}

export const EVIDENCE_NODE_TYPES = Object.freeze([...NODE_TYPES]);
export const EVIDENCE_EDGE_TYPES = Object.freeze([...EDGE_TYPES]);
