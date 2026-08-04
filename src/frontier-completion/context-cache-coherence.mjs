import { createHash } from 'node:crypto';

const FIELDS = Object.freeze(['sourceHash', 'branch', 'toolSchemaSha256', 'harnessRevision', 'tokenizerSha256']);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function normalize(provenance = {}) {
  const output = {};
  for (const field of FIELDS) {
    const value = String(provenance[field] ?? '').trim();
    if (!value) throw new TypeError(`context cache provenance requires ${field}`);
    output[field] = value;
  }
  return Object.freeze(output);
}
function digest(value) { return sha256(JSON.stringify(FIELDS.map((field) => value[field]))); }
function clone(value) { return structuredClone(value); }

export class ContextCacheCoherence {
  constructor() { this.entries = new Map(); this.invalidations = 0; }
  put(key, value, provenance) {
    const normalized = normalize(provenance);
    this.entries.set(String(key), { value: clone(value), provenance: normalized, digest: digest(normalized) });
    return this;
  }
  get(key, provenance) {
    const id = String(key); const entry = this.entries.get(id);
    if (!entry) return null;
    const normalized = normalize(provenance);
    if (digest(normalized) !== entry.digest) { this.entries.delete(id); this.invalidations += 1; return null; }
    return clone(entry.value);
  }
  invalidate(predicate = () => true) {
    let removed = 0;
    for (const [key, entry] of this.entries) if (predicate(entry.provenance, key)) { this.entries.delete(key); removed += 1; }
    this.invalidations += removed; return removed;
  }
  snapshot() { return Object.freeze({ schema: 'forge.context-cache-coherence.v1', entries: this.entries.size, invalidations: this.invalidations, keyFields: FIELDS }); }
}
