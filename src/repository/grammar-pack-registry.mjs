import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
const SHA = /^[a-f0-9]{64}$/i;
function fail(code, message) { const error = new Error(`${code}: ${message}`); error.code = code; throw error; }
function freeze(value) { if (!value || typeof value !== 'object') return value; if (Array.isArray(value)) { value.forEach(freeze); return Object.freeze(value); } Object.values(value).forEach(freeze); return Object.freeze(value); }
function versionOf(text) { return String(text ?? '').match(/tree-sitter\s+v?([0-9]+(?:\.[0-9]+){1,3})/i)?.[1] ?? null; }
export class GrammarPackRegistry {
  constructor({ packs = [], runner } = {}) {
    if (typeof runner !== 'function') throw new TypeError('runner is required');
    this.runner = runner; this.byExtension = new Map(); this.packs = [];
    for (const raw of packs) {
      const pack = freeze({ id: String(raw.id ?? '').trim(), languageId: String(raw.languageId ?? '').trim(), extensions: freeze([...(raw.extensions ?? [])].map((x) => String(x).toLowerCase())), command: String(raw.command ?? 'tree-sitter'), expectedVersion: String(raw.expectedVersion ?? ''), grammarSha256: String(raw.grammarSha256 ?? '').toLowerCase() });
      if (!pack.id || !pack.languageId || !pack.extensions.length || !pack.expectedVersion || !SHA.test(pack.grammarSha256)) fail('GRAMMAR_PACK_SCHEMA_INVALID', 'id, languageId, extensions, expectedVersion and grammarSha256 are required');
      this.packs.push(pack); for (const ext of pack.extensions) { if (this.byExtension.has(ext)) fail('GRAMMAR_PACK_EXTENSION_DUPLICATE', ext); this.byExtension.set(ext, pack); }
    }
  }
  resolve(filePath) { const lower = String(filePath).toLowerCase(); return [...this.byExtension.entries()].find(([ext]) => lower.endsWith(ext))?.[1] ?? null; }
  async capabilityForPath(filePath) {
    const pack = this.resolve(filePath); if (!pack) return freeze({ schema: 'forge.grammar-capability.v1', status: 'unavailable', reason: 'no-pack', parityClaimed: false });
    try {
      const result = await this.runner(pack.command, ['--version'], { maxOutputBytes: 64_000, timeoutMs: 5_000 });
      const version = versionOf(result?.stdout); const matches = version === pack.expectedVersion;
      const base = { schema: 'forge.grammar-capability.v1', packId: pack.id, languageId: pack.languageId, status: matches ? 'operated' : 'external-gate', reason: matches ? null : 'version-mismatch', version, expectedVersion: pack.expectedVersion, grammarSha256: pack.grammarSha256, externalRuntime: true, parityClaimed: matches };
      return freeze({ ...base, receiptSha256: canonicalSha256(base) });
    } catch (error) {
      const base = { schema: 'forge.grammar-capability.v1', packId: pack.id, languageId: pack.languageId, status: 'external-gate', reason: error?.code === 'ENOENT' ? 'not-installed' : 'probe-failed', version: null, expectedVersion: pack.expectedVersion, grammarSha256: pack.grammarSha256, externalRuntime: true, parityClaimed: false };
      return freeze({ ...base, receiptSha256: canonicalSha256(base) });
    }
  }
  async parse({ file, absolutePath } = {}) {
    const pack = this.resolve(file); if (!pack) fail('GRAMMAR_PACK_NOT_FOUND', `No grammar pack for ${file}`);
    const capability = await this.capabilityForPath(file); if (capability.status !== 'operated') fail('GRAMMAR_RUNTIME_UNAVAILABLE', capability.reason);
    const result = await this.runner(pack.command, ['parse', '--json', '--quiet', '--', String(absolutePath)], { maxOutputBytes: 2_000_000, timeoutMs: 15_000 });
    let tree; try { tree = JSON.parse(String(result?.stdout ?? '')); } catch { fail('GRAMMAR_OUTPUT_INVALID', 'parser returned invalid JSON'); }
    const base = { schema: 'forge.grammar-parse.v1', file: String(file), packId: pack.id, languageId: pack.languageId, runtimeVersion: capability.version, grammarSha256: pack.grammarSha256, tree };
    return freeze({ ...base, receiptSha256: canonicalSha256(base) });
  }
}
