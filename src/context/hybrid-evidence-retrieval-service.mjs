import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { redactSecrets } from '../security/redaction.mjs';
import { createEvidenceCard } from './evidence-card.mjs';

const SOURCES = Object.freeze(['lexical', 'semantic', 'structural', 'runtime', 'historical']);
const PATH_PATTERN = /(?:^|\s)((?:[A-Za-z]:)?[\w.@+-]+(?:[\\/][\w.@+-]+)+\.[A-Za-z0-9]+)(?=\s|$|[),:;])/g;
const ERROR_PATTERN = /(?:error|exception|failed?|failure|stack|status)\s*[:=-]?\s*([^\n]{3,180})/ig;
const IDENTIFIER_PATTERN = /\b[A-Za-z_$][A-Za-z0-9_$]*(?:[A-Z][A-Za-z0-9_$]*)+\b|\b[A-Za-z_$][A-Za-z0-9_$]{2,}\([^)]*\)/g;

function freeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) freeze(child, seen);
  return Object.freeze(value);
}
function required(value, label) { const text = String(value ?? '').trim(); if (!text) throw new TypeError(`${label} is required`); return text; }
function bounded(value, fallback, min, max, label) { const n = value == null ? fallback : Number(value); if (!Number.isInteger(n) || n < min || n > max) throw new TypeError(`${label} must be between ${min} and ${max}`); return n; }
function cleanText(value, max = 32_000) { return redactSecrets(String(value ?? '')).replace(/\u0000/g, '').slice(0, max); }
function uniquePush(items, seen, entry) {
  const query = String(entry.query ?? '').trim().slice(0, 1_000);
  if (!query) return;
  const key = `${entry.source}:${entry.counterEvidence === true}:${query.toLocaleLowerCase('en-US')}`;
  if (seen.has(key)) return;
  seen.add(key);
  items.push(Object.freeze({ query, source: entry.source, reason: String(entry.reason ?? '').slice(0, 500), counterEvidence: entry.counterEvidence === true }));
}
function concepts(text) {
  return [...new Set((String(text).toLowerCase().match(/[\p{L}\p{N}_$.-]{3,}/gu) ?? []).filter((term) => !['error', 'failed', 'after', 'with', 'from', 'when', 'only', 'cause', 'fix'].includes(term)))].slice(0, 12);
}

export function decomposeEvidenceQuery(query, { hypothesis = null, maxQueries = 12 } = {}) {
  const objective = required(query, 'query');
  const limit = bounded(maxQueries, 12, 1, 12, 'maxQueries');
  const items = []; const seen = new Set();
  const identifiers = [...new Set((objective.match(IDENTIFIER_PATTERN) ?? []).map((value) => value.replace(/\(.*$/, '')))].slice(0, 2);
  const paths = []; for (const match of objective.matchAll(PATH_PATTERN)) paths.push(match[1].replaceAll('\\', '/'));
  const errors = []; for (const match of objective.matchAll(ERROR_PATTERN)) errors.push(match[1].trim());
  for (const identifier of identifiers) uniquePush(items, seen, { source: 'lexical', query: identifier, reason: 'exact symbol or identifier' });
  for (const filePath of [...new Set(paths)].slice(0, 2)) uniquePush(items, seen, { source: 'lexical', query: filePath, reason: 'exact repository path' });
  for (const error of [...new Set(errors)].slice(0, 2)) uniquePush(items, seen, { source: 'runtime', query: error, reason: 'runtime error string' });
  const core = concepts(objective).slice(0, 8).join(' ') || objective;
  uniquePush(items, seen, { source: 'lexical', query: core, reason: 'literal terms and regex candidates' });
  uniquePush(items, seen, { source: 'structural', query: core, reason: 'dependency, call, import, and reference neighbors' });
  uniquePush(items, seen, { source: 'historical', query: `${core} previous failure patch decision`, reason: 'prior patches, decisions, and failed attempts' });
  uniquePush(items, seen, { source: 'runtime', query: `${core} runtime stack trace test failure console`, reason: 'runtime and test evidence' });
  if (hypothesis) uniquePush(items, seen, { source: 'runtime', query: `contradict alternative bypass ${String(hypothesis).slice(0, 700)}`, reason: 'counter-evidence for the active hypothesis', counterEvidence: true });
  uniquePush(items, seen, { source: 'semantic', query: objective, reason: 'conceptual similarity' });
  const selected = items.slice(0, limit);
  if (hypothesis && !selected.some((entry) => entry.counterEvidence)) {
    const counter = items.find((entry) => entry.counterEvidence);
    if (counter) selected[Math.max(0, selected.length - 1)] = counter;
  }
  return Object.freeze(selected);
}

function normalize(raw, source, query, rank, counterEvidence) {
  const path = raw.path == null ? null : String(raw.path).replaceAll('\\', '/').replace(/^\.\//, '').slice(0, 4_096);
  const startLine = Math.max(1, Number(raw.startLine ?? raw.line ?? 1) || 1);
  const endLine = Math.max(startLine, Number(raw.endLine ?? raw.line ?? startLine) || startLine);
  const sourceHash = /^[a-f0-9]{64}$/i.test(String(raw.sourceHash ?? raw.sha256 ?? raw.contentSha256 ?? '')) ? String(raw.sourceHash ?? raw.sha256 ?? raw.contentSha256).toLowerCase() : canonicalSha256({ source, path, startLine, endLine, text: String(raw.text ?? raw.preview ?? raw.label ?? raw.id ?? '') });
  const currentHash = /^[a-f0-9]{64}$/i.test(String(raw.currentHash ?? '')) ? String(raw.currentHash).toLowerCase() : null;
  const id = raw.nodeId ?? raw.id ?? null;
  const key = id ? `id:${String(id)}` : `loc:${path ?? source}:${startLine}:${endLine}:${sourceHash}`;
  const freshness = currentHash ? (currentHash === sourceHash ? 'fresh' : 'stale') : (raw.freshness ?? 'unknown');
  return {
    key,
    nodeId: raw.nodeId == null ? null : String(raw.nodeId),
    path,
    startLine,
    endLine,
    text: cleanText(raw.text ?? raw.preview ?? raw.label ?? raw.message ?? '', 32_000),
    sourceHash,
    currentHash,
    source,
    sources: new Set([source]),
    queries: new Set([query.query]),
    ranks: { [source]: rank },
    rrfScore: 1 / (60 + rank),
    confidence: Math.max(0, Math.min(1, Number(raw.confidence ?? 0.6) || 0.6)),
    graphDistance: raw.graphDistance == null ? null : Math.max(0, Number(raw.graphDistance) || 0),
    runtime: raw.runtime === true || source === 'runtime',
    updatedAt: raw.updatedAt == null ? null : String(raw.updatedAt),
    freshness,
    reason: cleanText(raw.reason ?? query.reason, 2_000),
    polarity: counterEvidence || raw.polarity === 'counter' ? 'counter' : 'support',
    metadata: raw.metadata && typeof raw.metadata === 'object' ? structuredClone(raw.metadata) : {},
    symbol: raw.symbol == null ? null : String(raw.symbol).slice(0, 512),
    branch: raw.branch == null ? null : String(raw.branch).slice(0, 512),
    worktree: raw.worktree == null ? null : String(raw.worktree).slice(0, 1_024),
    trust: Math.max(0, Math.min(1, Number(raw.trust ?? raw.confidence ?? 0.6) || 0.6)),
    tokenCost: Math.max(0, Math.floor(Number(raw.tokenCost ?? Math.max(1, Math.ceil(Buffer.byteLength(String(raw.text ?? raw.preview ?? raw.label ?? raw.message ?? ''), 'utf8') / 4))) || 0)),
    supports: Array.isArray(raw.supports) ? raw.supports.map(String).slice(0, 128) : [],
    contradicts: Array.isArray(raw.contradicts) ? raw.contradicts.map(String).slice(0, 128) : [],
    claim: cleanText(raw.claim ?? raw.reason ?? query.reason, 4_000),
    lease: Object.freeze({ validUntil: String(raw.validUntil ?? (source === 'runtime' ? 'test_rerun' : path ? 'file_changed' : 'source_changed')), sourceRef: String(raw.sourceRef ?? path ?? raw.id ?? key), sourceHash }),
  };
}
function merge(target, incoming) {
  target.rrfScore += incoming.rrfScore;
  for (const value of incoming.sources) target.sources.add(value);
  for (const value of incoming.queries) target.queries.add(value);
  target.ranks = { ...target.ranks, ...incoming.ranks };
  target.confidence = Math.max(target.confidence, incoming.confidence);
  target.runtime ||= incoming.runtime;
  if (target.freshness === 'unknown' || incoming.freshness === 'stale') target.freshness = incoming.freshness;
  if (incoming.graphDistance != null && (target.graphDistance == null || incoming.graphDistance < target.graphDistance)) target.graphDistance = incoming.graphDistance;
  if (!target.nodeId && incoming.nodeId) target.nodeId = incoming.nodeId;
  if (incoming.text.length > target.text.length) target.text = incoming.text;
  if (incoming.polarity === 'counter') target.polarity = 'counter';
  target.trust = Math.max(target.trust, incoming.trust);
  target.tokenCost = Math.min(target.tokenCost, incoming.tokenCost);
  target.supports = [...new Set([...target.supports, ...incoming.supports])];
  target.contradicts = [...new Set([...target.contradicts, ...incoming.contradicts])];
  if (!target.symbol && incoming.symbol) target.symbol = incoming.symbol;
  if (!target.branch && incoming.branch) target.branch = incoming.branch;
  if (!target.worktree && incoming.worktree) target.worktree = incoming.worktree;
}
function publicItem(item) {
  const graphBoost = item.graphDistance == null ? 0 : 0.05 / (1 + item.graphDistance);
  const runtimeBoost = item.runtime ? 0.03 : 0;
  const freshnessPenalty = item.freshness === 'stale' ? 0.08 : 0;
  const confidenceBoost = item.confidence * 0.01;
  const score = Math.max(0, item.rrfScore + graphBoost + runtimeBoost + confidenceBoost - freshnessPenalty);
  const sources = [...item.sources].sort();
  const card = createEvidenceCard({
    source: sources[0] ?? 'unknown', path: item.path ?? item.lease.sourceRef, symbol: item.symbol,
    startLine: item.startLine, endLine: item.endLine, sourceHash: item.sourceHash, currentHash: item.currentHash,
    branch: item.branch, worktree: item.worktree, freshness: item.freshness, claim: item.claim || item.reason,
    trust: item.trust, supports: item.supports, contradicts: item.contradicts, tokenCost: item.tokenCost,
    tokenCostMethod: 'retriever-provided-or-utf8-quarter', text: item.text,
  });
  return freeze({
    key: item.key, nodeId: item.nodeId, path: item.path, startLine: item.startLine, endLine: item.endLine, text: card.text,
    sourceHash: item.sourceHash, currentHash: item.currentHash, sources, queries: [...item.queries], ranks: item.ranks,
    rrfScore: item.rrfScore, score, confidence: item.confidence, graphDistance: item.graphDistance, runtime: item.runtime,
    updatedAt: item.updatedAt, freshness: item.freshness, reason: item.reason, polarity: item.polarity, metadata: item.metadata, lease: item.lease,
    evidenceId: card.evidenceId, evidenceCardReceiptSha256: card.receiptSha256, source: card.source, symbol: card.symbol,
    lines: card.lines, branch: card.branch, worktree: card.worktree, claim: card.claim, trust: card.trust,
    supports: card.supports, contradicts: card.contradicts, tokenCost: card.tokenCost, tokenCostMethod: card.tokenCostMethod,
  });
}

export class HybridEvidenceRetrievalService {
  constructor({ version = '0.0.0', retrievers = {}, clock = Date.now } = {}) {
    for (const source of SOURCES) if (typeof retrievers[source] !== 'function') throw new TypeError(`retriever ${source} is required`);
    this.version = String(version);
    this.retrievers = retrievers;
    this.clock = clock;
  }

  async retrieve(input = {}) {
    const projectId = required(input.projectId, 'projectId');
    const principalId = required(input.principalId, 'principalId');
    const query = required(input.query, 'query');
    const limit = bounded(input.limit, 20, 1, 200, 'limit');
    const perRetrieverLimit = bounded(input.perRetrieverLimit, 30, 1, 200, 'perRetrieverLimit');
    const queries = decomposeEvidenceQuery(query, { hypothesis: input.hypothesis, maxQueries: bounded(input.maxQueries, 12, 1, 12, 'maxQueries') });
    const merged = new Map(); const omissions = [];
    for (const decomposition of queries) {
      const retriever = this.retrievers[decomposition.source];
      try {
        const output = await retriever({ projectId, principalId, query: decomposition.query, limit: perRetrieverLimit, counterEvidence: decomposition.counterEvidence, reason: decomposition.reason });
        const items = Array.isArray(output) ? output : Array.isArray(output?.items) ? output.items : [];
        for (let index = 0; index < Math.min(items.length, perRetrieverLimit); index += 1) {
          const normalized = normalize(items[index], decomposition.source, decomposition, index + 1, decomposition.counterEvidence);
          const existing = merged.get(normalized.key);
          if (existing) merge(existing, normalized); else merged.set(normalized.key, normalized);
        }
      } catch (error) {
        omissions.push(Object.freeze({ source: decomposition.source, query: decomposition.query, reason: 'retriever-error', error: String(error.message ?? error).slice(0, 1_000) }));
      }
    }
    const ranked = [...merged.values()].map(publicItem).sort((a, b) => b.score - a.score || b.rrfScore - a.rrfScore || a.key.localeCompare(b.key));
    const counterEvidence = ranked.filter((item) => item.polarity === 'counter').slice(0, limit);
    const evidence = ranked.filter((item) => item.polarity !== 'counter').slice(0, limit);
    const base = { schema: 'forge.hybrid-evidence-retrieval.v1', version: this.version, projectId, principalId, query, hypothesis: input.hypothesis == null ? null : String(input.hypothesis), formula: 'sum(1/(60+rank))', queries, evidence, counterEvidence, omissions, generatedAt: new Date(Number(this.clock())).toISOString() };
    return freeze({ ...base, receiptSha256: canonicalSha256(base) });
  }
}

export const EVIDENCE_RETRIEVAL_SOURCES = SOURCES;
