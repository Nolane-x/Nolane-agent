import path from 'node:path';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { redactSecrets } from '../security/redaction.mjs';

const HASH = /^[a-f0-9]{64}$/i;
const RECEIPT_KEYS = new Set(['receiptSha256', 'sourceReceiptSha256', 'previousReceiptSha256', 'evidenceReceiptSha256', 'providerReceiptSha256', 'guardrailReceiptSha256', 'decisionReceiptSha256', 'operationReceiptSha256']);
const ARTIFACT_KEYS = new Set(['artifactSha256', 'fileSha256', 'contentSha256', 'diffSha256', 'snapshotSha256']);
const BLOCKED_KEYS = /^(?:env|environment|stdin|password|secret|token|authorization|credential|clientSecret|apiKey|systemPrompt|hiddenReasoning|chainOfThought|rawPrompt|filePath|metadataPath)$/i;

function required(value, label) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`${label} is required`);
  return result;
}
function integer(value, fallback, min, max, label) {
  const parsed = value == null ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new TypeError(`${label} must be between ${min} and ${max}`);
  return parsed;
}
function clip(value, max = 500) { return value == null ? null : String(value).slice(0, max); }
function freeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) freeze(child, seen);
  return Object.freeze(value);
}
function safeHash(value) { const text = String(value ?? ''); return HASH.test(text) ? text.toLowerCase() : null; }
function safePath(value) {
  const text = String(value ?? '');
  if (!text) return null;
  if (path.isAbsolute(text)) return `<workspace>/${path.basename(text)}`;
  return text.slice(0, 500);
}
function publicValue(value, { depth = 0, maxDepth = 5, maxArray = 64, maxKeys = 96 } = {}) {
  if (depth > maxDepth) return '[TRUNCATED]';
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return clip(redactSecrets(value), 4_000);
  if (Array.isArray(value)) return value.slice(0, maxArray).map((item) => publicValue(item, { depth: depth + 1, maxDepth, maxArray, maxKeys }));
  if (typeof value !== 'object') return clip(value, 500);
  const result = {};
  for (const [key, child] of Object.entries(value).slice(0, maxKeys)) {
    if (BLOCKED_KEYS.test(key)) continue;
    if (/path$/i.test(key) && typeof child === 'string') result[key] = safePath(child);
    else result[key] = publicValue(child, { depth: depth + 1, maxDepth, maxArray, maxKeys });
  }
  return redactSecrets(result);
}
function refsView(refs = {}) {
  return freeze({
    projectId: clip(refs.projectId, 200), missionId: clip(refs.missionId, 200), taskId: clip(refs.taskId, 200),
    runId: clip(refs.runId, 200), sessionId: clip(refs.sessionId, 200), providerId: clip(refs.providerId, 160),
  });
}
function category(type) {
  const value = String(type ?? '').toLowerCase();
  if (value.includes('permission') || value.includes('capability') || value.includes('approval')) return 'permission';
  if (value.includes('verification') || value.includes('test')) return 'verification';
  if (value.includes('tool') || value.includes('process') || value.includes('terminal')) return 'tool';
  if (value.includes('model') || value.includes('provider')) return 'model';
  if (value.includes('fail') || value.includes('error') || value.includes('blocked')) return 'failure';
  if (value.includes('fact') || value.includes('claim') || value.includes('memory')) return 'knowledge';
  return 'runtime';
}
function eventView(event) {
  const payload = publicValue(event.payload ?? {});
  return freeze({ seq: Number(event.seq), id: clip(event.id, 200), time: clip(event.time, 80), type: clip(event.type, 160), category: category(event.type), refs: refsView(event.refs), payload });
}
function evidenceView(item) {
  return freeze({
    id: clip(item.id, 200), taskId: clip(item.taskId, 200), kind: clip(item.kind, 160), status: clip(item.status, 40),
    receiptSha256: safeHash(item.receiptSha256), createdAt: clip(item.createdAt, 80), payload: publicValue(item.payload ?? {}),
  });
}
function normalizedFailureText(value) {
  return String(value ?? 'unknown failure').toLowerCase()
    .replace(/\b(?:[a-z]:)?(?:[\w.-]+[\\/])+[\w.-]+\b/gi, '<path>')
    .replace(/\b\d+\b/g, '#').replace(/\s+/g, ' ').trim().slice(0, 500);
}
function failureInput(item, source) {
  const payload = item.payload ?? {};
  const type = item.type ?? item.kind ?? source;
  const isFailure = item.status && item.status !== 'pass' || /fail|error|blocked|denied|timeout/i.test(String(type)) || payload.status === 'fail' || Number(payload.exitCode) > 0;
  if (!isFailure) return null;
  const code = clip(payload.code ?? payload.errorCode ?? item.kind ?? item.type ?? 'FAILURE', 160);
  const summary = clip(payload.summary ?? payload.reason ?? payload.message ?? payload.error ?? `${type} failed`, 1_000);
  const fingerprint = canonicalSha256({ code: String(code).toUpperCase(), summary: normalizedFailureText(summary) });
  return { fingerprint, code, summary, source, at: item.time ?? item.createdAt ?? null, refs: item.refs ?? { taskId: item.taskId ?? null }, receiptSha256: safeHash(item.receiptSha256 ?? payload.receiptSha256) };
}
function clusterFailures(events, evidence, maxClusters) {
  const clusters = new Map();
  for (const input of [...events.map((item) => failureInput(item, 'event')), ...evidence.map((item) => failureInput(item, 'evidence'))].filter(Boolean)) {
    const cluster = clusters.get(input.fingerprint) ?? { fingerprint: input.fingerprint, code: input.code, summary: input.summary, count: 0, firstAt: input.at, lastAt: input.at, sources: new Set(), taskIds: new Set(), receipts: new Set() };
    cluster.count += 1; cluster.lastAt = input.at ?? cluster.lastAt; cluster.sources.add(input.source);
    if (input.refs?.taskId) cluster.taskIds.add(String(input.refs.taskId));
    if (input.receiptSha256) cluster.receipts.add(input.receiptSha256);
    clusters.set(input.fingerprint, cluster);
  }
  return freeze([...clusters.values()].sort((a, b) => b.count - a.count || String(b.lastAt).localeCompare(String(a.lastAt))).slice(0, maxClusters).map((item) => ({ ...item, sources: [...item.sources], taskIds: [...item.taskIds], receipts: [...item.receipts] })));
}
function claimView(record, source) {
  const payload = record.payload ?? {};
  const claim = payload.claim ?? payload.title ?? (/(?:claim|fact|memory)/i.test(String(record.type ?? record.kind)) ? payload.summary : null);
  if (!claim) return null;
  return freeze({ id: canonicalSha256({ source, id: record.id, claim: String(claim) }), source, claim: clip(claim, 1_500), confidence: Number.isFinite(Number(payload.confidence)) ? Number(payload.confidence) : null, status: clip(payload.status ?? record.status ?? 'observed', 60), receiptSha256: safeHash(record.receiptSha256 ?? payload.receiptSha256), refs: record.refs ? refsView(record.refs) : freeze({ taskId: clip(record.taskId, 200) }), createdAt: clip(record.time ?? record.createdAt, 80) });
}
function graphFor(events, evidence, claims, { maxNodes, maxEdges }) {
  const nodes = new Map(); const edges = new Map();
  const addNode = (id, type, label, metadata = {}) => { if (!id || nodes.size >= maxNodes && !nodes.has(id)) return; if (!nodes.has(id)) nodes.set(id, freeze({ id, type, label: clip(label, 180), metadata: publicValue(metadata, { maxDepth: 2, maxArray: 16, maxKeys: 24 }) })); };
  const addEdge = (from, to, type, metadata = {}) => { if (!from || !to || edges.size >= maxEdges) return; const id = canonicalSha256({ from, to, type, metadata }); if (!edges.has(id)) edges.set(id, freeze({ id, from, to, type, metadata: publicValue(metadata, { maxDepth: 2, maxArray: 16, maxKeys: 24 }) })); };
  const inspect = (record, source, sourceId) => {
    const payload = record.payload ?? {};
    const rootReceipt = safeHash(record.receiptSha256 ?? payload.receiptSha256);
    if (rootReceipt) addNode(`receipt:${rootReceipt}`, 'receipt', `${source} receipt`, { sourceId });
    const walk = (node, depth = 0) => {
      if (!node || typeof node !== 'object' || depth > 4) return;
      for (const [key, value] of Object.entries(node)) {
        const hash = safeHash(value);
        if (hash && RECEIPT_KEYS.has(key)) {
          const id = `receipt:${hash}`; addNode(id, 'receipt', key, { sourceId });
          if (rootReceipt && hash !== rootReceipt) addEdge(`receipt:${rootReceipt}`, id, 'derived-from', { key, source });
        } else if (hash && ARTIFACT_KEYS.has(key)) {
          const id = `artifact:${hash}`; addNode(id, 'artifact', key, { sourceId });
          if (rootReceipt) addEdge(`receipt:${rootReceipt}`, id, 'attests', { key, source });
        } else if (value && typeof value === 'object') walk(value, depth + 1);
      }
    };
    walk(payload);
  };
  for (const event of events) inspect(event, 'event', event.id);
  for (const item of evidence) inspect(item, 'evidence', item.id);
  for (const claim of claims) {
    const claimId = `claim:${claim.id}`; addNode(claimId, 'claim', claim.claim, { confidence: claim.confidence, status: claim.status });
    if (claim.receiptSha256) { const receiptId = `receipt:${claim.receiptSha256}`; addNode(receiptId, 'receipt', 'claim receipt'); addEdge(receiptId, claimId, 'supports'); }
  }
  return freeze({ nodes: [...nodes.values()], edges: [...edges.values()] });
}
function artifactView(record = {}) {
  return freeze({ id: clip(record.id, 160), kind: clip(record.kind, 120), bytes: Number(record.bytes ?? 0), sha256: safeHash(record.sha256), preview: clip(record.preview, 1_000), createdAt: clip(record.createdAt, 80), refs: refsView(record.refs) });
}

export class TraceEvidenceCenterService {
  constructor({ version, store, contextStore, clock = () => new Date().toISOString(), limits = {} } = {}) {
    if (!store?.getProject || !store?.listEvents || !store?.listEvidence || !store?.listTasks) throw new TypeError('TraceEvidenceCenterService store is required');
    if (!contextStore?.artifactize) throw new TypeError('TraceEvidenceCenterService contextStore is required');
    this.version = String(version ?? '0.0.0'); this.store = store; this.contextStore = contextStore; this.clock = clock;
    this.limits = freeze({ events: integer(limits.events, 2_000, 10, 20_000, 'events limit'), scan: integer(limits.scan, 50_000, 100, 100_000, 'scan limit'), evidence: integer(limits.evidence, 5_000, 10, 20_000, 'evidence limit'), nodes: integer(limits.nodes, 5_000, 10, 20_000, 'graph nodes limit'), edges: integer(limits.edges, 10_000, 10, 50_000, 'graph edges limit'), failures: integer(limits.failures, 500, 1, 5_000, 'failure cluster limit'), claims: integer(limits.claims, 1_000, 1, 10_000, 'claims limit') });
  }
  #scope({ projectId, principalId, missionId = null, taskId = null } = {}) {
    const project = required(projectId, 'projectId'); const principal = required(principalId, 'An authenticated principal');
    if (!this.store.getProject(project)) throw Object.assign(new Error('Unknown project'), { statusCode: 404, code: 'TRACE_PROJECT_NOT_FOUND' });
    if (missionId) { const mission = this.store.getMission(String(missionId)); if (!mission) throw Object.assign(new Error('Unknown mission'), { statusCode: 404 }); if (mission.projectId !== project) throw Object.assign(new Error('Mission project scope denied'), { statusCode: 403, code: 'TRACE_SCOPE_DENIED' }); }
    if (taskId) { const task = this.store.getTask(String(taskId)); if (!task) throw Object.assign(new Error('Unknown task'), { statusCode: 404 }); if (task.projectId !== project) throw Object.assign(new Error('Task project scope denied'), { statusCode: 403, code: 'TRACE_SCOPE_DENIED' }); if (missionId && task.missionId !== missionId) throw Object.assign(new Error('Task mission scope denied'), { statusCode: 403, code: 'TRACE_SCOPE_DENIED' }); }
    return { projectId: project, principalId: principal, missionId: missionId ? String(missionId) : null, taskId: taskId ? String(taskId) : null };
  }
  async #projectEvents(scope, { afterSeq = 0, limit = this.limits.events } = {}) {
    const wanted = integer(limit, this.limits.events, 1, this.limits.events, 'limit'); let cursor = integer(afterSeq, 0, 0, Number.MAX_SAFE_INTEGER, 'afterSeq'); const items = []; let scanned = 0; let exhausted = false;
    while (items.length < wanted && scanned < this.limits.scan && !exhausted) {
      const batch = this.store.listEvents({ afterSeq: cursor, limit: Math.min(1_000, this.limits.scan - scanned) });
      if (!batch.length) { exhausted = true; break; }
      scanned += batch.length; cursor = Number(batch.at(-1).seq);
      for (const raw of batch) {
        if (String(raw.refs?.projectId ?? '') !== scope.projectId) continue;
        if (scope.missionId && String(raw.refs?.missionId ?? '') !== scope.missionId) continue;
        if (scope.taskId && String(raw.refs?.taskId ?? '') !== scope.taskId) continue;
        items.push(eventView(raw)); if (items.length >= wanted) break;
      }
      if (batch.length < Math.min(1_000, this.limits.scan - (scanned - batch.length))) exhausted = true;
    }
    return freeze({ items, nextSeq: items.length >= wanted ? items.at(-1).seq : null, scanned, exhausted });
  }
  async events(input = {}) {
    const scope = this.#scope(input); const page = await this.#projectEvents(scope, input);
    const base = { schema: 'forge.trace-event-page.v1', version: this.version, ...scope, generatedAt: this.clock(), afterSeq: Number(input.afterSeq ?? 0), nextSeq: page.nextSeq, scanned: page.scanned, items: page.items };
    return freeze({ ...base, receiptSha256: canonicalSha256(base) });
  }
  #evidence(scope) {
    let taskIds = null;
    if (scope.taskId) taskIds = new Set([scope.taskId]);
    else if (scope.missionId) taskIds = new Set(this.store.listTasks({ projectId: scope.projectId, missionId: scope.missionId }).map((task) => task.id));
    const records = this.store.listEvidence({ projectId: scope.projectId });
    return freeze(records.filter((item) => !taskIds || item.taskId && taskIds.has(item.taskId)).slice(-this.limits.evidence).map(evidenceView));
  }
  async snapshot(input = {}) {
    const scope = this.#scope(input); const page = await this.#projectEvents(scope, { afterSeq: input.afterSeq, limit: integer(input.limit, Math.min(500, this.limits.events), 1, this.limits.events, 'limit') }); const evidence = this.#evidence(scope);
    const claims = freeze([...page.items.map((item) => claimView(item, 'event')), ...evidence.map((item) => claimView(item, 'evidence'))].filter(Boolean).slice(0, this.limits.claims));
    const failures = clusterFailures(page.items, evidence, this.limits.failures);
    const graph = graphFor(page.items, evidence, claims, { maxNodes: this.limits.nodes, maxEdges: this.limits.edges });
    const base = { schema: 'forge.trace-evidence-center.v1', version: this.version, ...scope, generatedAt: this.clock(), summary: freeze({ events: page.items.length, evidence: evidence.length, receipts: graph.nodes.filter((node) => node.type === 'receipt').length, artifacts: graph.nodes.filter((node) => node.type === 'artifact').length, claims: claims.length, failureClusters: failures.length, failedEvidence: evidence.filter((item) => item.status !== 'pass').length }), timeline: page.items, evidence, claims, failures, graph, page: freeze({ afterSeq: Number(input.afterSeq ?? 0), nextSeq: page.nextSeq, scanned: page.scanned }) };
    return freeze({ ...base, receiptSha256: canonicalSha256(base) });
  }
  async exportBundle(input = {}) {
    const scope = this.#scope(input); const snapshot = await this.snapshot({ ...input, limit: this.limits.events });
    const label = required(input.label ?? 'Trace evidence export', 'label').slice(0, 500); const exportedAt = this.clock();
    const bundle = { schema: 'forge.trace-evidence-bundle.v1', version: this.version, projectId: scope.projectId, missionId: scope.missionId, taskId: scope.taskId, label, exportedAt, exportedBy: scope.principalId, snapshot };
    const artifact = await this.contextStore.artifactize({ kind: 'trace-evidence-export', content: `${JSON.stringify(bundle, null, 2)}\n`, metadata: { label, schema: bundle.schema, snapshotReceiptSha256: snapshot.receiptSha256 } }, { projectId: scope.projectId, taskId: scope.taskId ?? 'project', runId: scope.missionId ?? 'trace-export', refs: { projectId: scope.projectId, missionId: scope.missionId, taskId: scope.taskId, principalId: scope.principalId } });
    const base = { schema: 'forge.trace-evidence-export.v1', version: this.version, ...scope, label, exportedAt, snapshotReceiptSha256: snapshot.receiptSha256, artifact: artifactView(artifact) };
    return freeze({ ...base, receiptSha256: canonicalSha256(base) });
  }
}
