import { createHash } from 'node:crypto';
import { canonicalJson } from '../update/canonical-json.mjs';
function hash(value) { return createHash('sha256').update(canonicalJson(value)).digest('hex'); }
export class PluginTransparencyLog {
  constructor({ clock = () => Date.now(), storage = null } = {}) {
    this.clock = clock;
    this.storage = storage;
    this.entries = (storage?.loadAll?.() ?? []).map((entry) => Object.freeze({ ...entry }));
    const restored = PluginTransparencyLog.verifyEntries(this.entries);
    if (!restored.valid) throw new Error(`plugin transparency log is corrupted at index ${restored.index}: ${restored.reason}`);
  }
  append(input = {}) {
    const previousHash = this.entries.at(-1)?.entryHash ?? '0'.repeat(64);
    const body = { index: this.entries.length, previousHash, publisherId: String(input.publisherId ?? ''), keyId: String(input.keyId ?? ''), pluginId: String(input.pluginId ?? ''), rootHash: String(input.rootHash ?? ''), action: String(input.action ?? 'publish'), at: new Date(this.clock()).toISOString() };
    if (!body.publisherId || !body.keyId || !body.pluginId || !/^[a-f0-9]{64}$/i.test(body.rootHash)) throw new TypeError('publisherId, keyId, pluginId and sha256 rootHash are required');
    const entry = Object.freeze({ ...body, entryHash: hash(body) });
    this.storage?.append?.(entry);
    this.entries.push(entry);
    return entry;
  }
  export() { return this.entries.map((entry) => ({ ...entry })); }
  verify() { return PluginTransparencyLog.verifyEntries(this.entries); }
  static verifyEntries(entries = []) { let previousHash = '0'.repeat(64); for (let index = 0; index < entries.length; index += 1) { const entry = entries[index]; const body = { index: entry.index, previousHash: entry.previousHash, publisherId: entry.publisherId, keyId: entry.keyId, pluginId: entry.pluginId, rootHash: entry.rootHash, action: entry.action, at: entry.at }; if (entry.index !== index || entry.previousHash !== previousHash || hash(body) !== entry.entryHash) return Object.freeze({ valid: false, index, reason: 'hash-chain-mismatch' }); previousHash = entry.entryHash; } return Object.freeze({ valid: true, entries: entries.length, head: previousHash }); }
}
