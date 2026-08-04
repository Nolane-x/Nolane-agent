import { createHash } from 'node:crypto';
import path from 'node:path';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const freeze = (value) => Object.freeze(value);
const SECRET = /(^|\/)(\.env(?:\.|$)|\.git(?:\/|$)|.*\.(?:pem|key|p12|pfx)$|credentials?(?:\.|\/|$)|secrets?(?:\.|\/|$))/i;
function safeRelative(value) {
  const normalized = String(value ?? '').replaceAll('\\', '/').replace(/^\.\//, '');
  if (!normalized || normalized.startsWith('/') || normalized === '..' || normalized.startsWith('../') || normalized.includes('/../') || SECRET.test(normalized)) return null;
  return normalized;
}
export class RepositoryIntelligenceFabric {
  constructor({ search, codeIntelligence = null, maxResults = 200 } = {}) {
    if (typeof search !== 'function') throw new TypeError('search function is required');
    this.searchBackend = search; this.codeIntelligence = codeIntelligence; this.maxResults = Math.max(1, Math.min(2_000, Number(maxResults) || 200));
  }
  async search({ query, limit = 50, workspaceRoot, hints = [], projectId = null } = {}) {
    const q = String(query ?? '').trim(); if (!q) throw new TypeError('query is required');
    const bounded = Math.max(1, Math.min(this.maxResults, Number(limit) || 50));
    const safeHints = [...new Set(hints.map(safeRelative).filter(Boolean))].sort();
    const raw = await this.searchBackend({ query: q, limit: bounded, workspaceRoot: path.resolve(workspaceRoot ?? '.'), hints: safeHints, projectId: projectId == null ? null : String(projectId) });
    const results = (Array.isArray(raw) ? raw : []).slice(0, bounded).map((row) => freeze({ path: safeRelative(row.path) ?? String(row.path ?? ''), line: Math.max(1, Number(row.line) || 1), preview: String(row.preview ?? '').slice(0, 2_000), score: Number(row.score) || 0 }));
    const base = { schema: 'nolane.repository-search.v1', query: q, hints: safeHints, results };
    return freeze({ ...base, hints: freeze(safeHints), results: freeze(results), receiptSha256: sha256(JSON.stringify(base)) });
  }
  async symbols({ projectRoot, languageId, query = '', limit = 100, projectId = null } = {}) {
    if (!this.codeIntelligence?.workspaceSymbols) return freeze({ schema: 'nolane.repository-symbols.v1', source: 'unavailable', items: freeze([]) });
    const result = await this.codeIntelligence.workspaceSymbols({ projectRoot, languageId, query, limit: Math.min(this.maxResults, Number(limit) || 100), projectId });
    return freeze({ schema: 'nolane.repository-symbols.v1', source: result.source ?? 'unknown', items: freeze([...(result.items ?? [])]) });
  }
  planFileSync({ sourceRoot, targetRoot, files = [] } = {}) {
    const accepted = []; const rejected = [];
    for (const value of files) { const safe = safeRelative(value); if (safe) accepted.push(safe); else rejected.push(String(value)); }
    const unique = [...new Set(accepted)].sort();
    const base = { schema: 'nolane.file-sync-plan.v1', sourceRoot: path.resolve(sourceRoot ?? '.'), targetRoot: path.resolve(targetRoot ?? '.'), files: unique, rejected: rejected.sort() };
    return freeze({ ...base, files: freeze(base.files), rejected: freeze(base.rejected), receiptSha256: sha256(JSON.stringify(base)) });
  }
}
