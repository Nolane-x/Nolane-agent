import path from 'node:path';
import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const STATUSES = new Set(['operated', 'contract-tested', 'degraded', 'unavailable', 'external-gate']);
function fail(code, message) { const error = new Error(`${code}: ${message}`); error.code = code; throw error; }
function freeze(value) { if (!value || typeof value !== 'object') return value; if (Array.isArray(value)) { value.forEach(freeze); return Object.freeze(value); } Object.values(value).forEach(freeze); return Object.freeze(value); }
function capability(raw = {}, fallback = 'unavailable') {
  const status = String(raw.status ?? fallback);
  if (!STATUSES.has(status)) fail('LANGUAGE_CAPABILITY_STATUS_INVALID', `Unsupported capability status: ${status}`);
  return freeze({ status, provider: raw.provider ? String(raw.provider) : null, version: raw.version ? String(raw.version) : null, evidenceId: raw.evidenceId ? String(raw.evidenceId) : null, reason: raw.reason ? String(raw.reason) : null });
}
export class LanguageCapabilityMatrix {
  constructor({ languages = [] } = {}) {
    this.byId = new Map(); this.byExtension = new Map();
    for (const raw of languages) {
      const id = String(raw.id ?? '').trim(); if (!id) fail('LANGUAGE_CAPABILITY_ID_REQUIRED', 'language id is required');
      if (this.byId.has(id)) fail('LANGUAGE_CAPABILITY_DUPLICATE', `Duplicate language: ${id}`);
      const extensions = [...new Set((raw.extensions ?? []).map((x) => String(x).toLowerCase()))];
      for (const ext of extensions) { if (!ext.startsWith('.')) fail('LANGUAGE_CAPABILITY_EXTENSION_INVALID', `Invalid extension: ${ext}`); if (this.byExtension.has(ext)) fail('LANGUAGE_CAPABILITY_EXTENSION_DUPLICATE', `Extension already registered: ${ext}`); }
      const row = freeze({ id, extensions: freeze(extensions), parser: capability(raw.parser), lsp: capability(raw.lsp), build: capability(raw.build), test: capability(raw.test), runtime: capability(raw.runtime), graph: capability(raw.graph), parityClaimed: false });
      this.byId.set(id, row); for (const ext of extensions) this.byExtension.set(ext, row);
    }
  }
  resolveByPath(filePath) { return this.byExtension.get(path.extname(String(filePath)).toLowerCase()) ?? null; }
  status(id) { return this.byId.get(String(id)) ?? null; }
  list() { return freeze([...this.byId.values()]); }
  snapshot() { const base = { schema: 'forge.language-capability-matrix.v1', languages: this.list(), parityClaimed: false }; return freeze({ ...base, receiptSha256: canonicalSha256(base) }); }
}
