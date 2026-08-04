import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
const SHA = /^[a-f0-9]{64}$/i;
function freeze(value) { if (!value || typeof value !== 'object') return value; if (Array.isArray(value)) { value.forEach(freeze); return Object.freeze(value); } Object.values(value).forEach(freeze); return Object.freeze(value); }
function nodeId(row) { return String(row.id ?? canonicalSha256({ kind: row.kind ?? 'unknown', name: row.name ?? '', path: row.path ?? '' })); }
function normalizeProvenance(value = {}, source) { return freeze({ source, path: String(value.path ?? ''), line: Number(value.line ?? 0), sourceSha256: SHA.test(String(value.sourceSha256 ?? '')) ? String(value.sourceSha256).toLowerCase() : canonicalSha256(String(value.path ?? '') + ':' + String(value.line ?? 0)), receiptId: value.receiptId ? String(value.receiptId) : null }); }
export class RelationshipGraphFusionService {
  constructor() { this.nodes = new Map(); this.edges = new Map(); }
  ingest({ source = 'unknown', nodes = [], edges = [] } = {}) {
    for (const raw of nodes) { const id = nodeId(raw); const current = this.nodes.get(id); this.nodes.set(id, freeze({ id, kind: String(raw.kind ?? current?.kind ?? 'unknown'), name: String(raw.name ?? current?.name ?? ''), path: raw.path ? String(raw.path) : current?.path ?? null, source: String(source) })); }
    for (const raw of edges) {
      const ambiguousTargets = freeze([...(raw.ambiguousTargets ?? [])].map(String).sort());
      const ambiguous = !raw.to || ambiguousTargets.length > 0 || raw.ambiguous === true;
      const provenance = normalizeProvenance(raw.provenance, String(source));
      const base = { from: String(raw.from ?? ''), to: raw.to == null ? null : String(raw.to), relation: String(raw.relation ?? 'related'), confidence: Math.max(0, Math.min(1, Number(raw.confidence ?? 0.5))), ambiguous, ambiguousTargets, guessed: false, provenance };
      const id = canonicalSha256(base); this.edges.set(id, freeze({ id, ...base }));
    }
    return this.snapshot();
  }
  query({ nodeId: id = null, relation = null } = {}) { return freeze([...this.edges.values()].filter((edge) => (!id || edge.from === id || edge.to === id || edge.ambiguousTargets.includes(id)) && (!relation || edge.relation === relation))); }
  snapshot() { const base = { schema: 'forge.relationship-graph-fusion.v1', nodes: freeze([...this.nodes.values()].sort((a,b) => a.id.localeCompare(b.id))), edges: freeze([...this.edges.values()].sort((a,b) => a.id.localeCompare(b.id))), ambiguityPreserved: true }; return freeze({ ...base, receiptSha256: canonicalSha256(base) }); }
}
