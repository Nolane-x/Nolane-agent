import path from 'node:path';
import { LspClient } from './lsp-client.mjs';
import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
function freeze(value) { if (!value || typeof value !== 'object') return value; if (Array.isArray(value)) { value.forEach(freeze); return Object.freeze(value); } Object.values(value).forEach(freeze); return Object.freeze(value); }
export class LspSessionPool {
  constructor({ idleTtlMs = 30_000, maxSessions = 8, clientFactory = (definition) => new LspClient(definition), now = () => Date.now() } = {}) {
    this.idleTtlMs = Math.max(10, Number(idleTtlMs) || 30_000); this.maxSessions = Math.max(1, Math.min(64, Number(maxSessions) || 8)); this.clientFactory = clientFactory; this.now = now; this.sessions = new Map();
  }
  #key(languageId, workspaceRoot, definition) { return `${String(languageId)}\0${path.resolve(String(workspaceRoot))}\0${String(definition?.id ?? definition?.command ?? '')}`; }
  async acquire({ languageId, workspaceRoot, definition, rootUri = null } = {}) {
    const key = this.#key(languageId, workspaceRoot, definition); let session = this.sessions.get(key);
    if (!session) {
      if (this.sessions.size >= this.maxSessions) await this.sweep({ forceOldest: true });
      const client = this.clientFactory(definition); await client.initialize({ rootUri, capabilities: {} });
      session = { key, languageId: String(languageId), workspaceRoot: path.resolve(String(workspaceRoot)), client, consumers: 0, createdAt: this.now(), lastUsedAt: this.now(), definitionId: String(definition?.id ?? '') };
      this.sessions.set(key, session);
    }
    session.consumers += 1; session.lastUsedAt = this.now(); let released = false;
    return Object.freeze({ client: session.client, release: () => { if (released) return; released = true; session.consumers = Math.max(0, session.consumers - 1); session.lastUsedAt = this.now(); } });
  }
  async sweep({ forceOldest = false } = {}) {
    const now = this.now(); let entries = [...this.sessions.values()].filter((x) => x.consumers === 0 && now - x.lastUsedAt >= this.idleTtlMs);
    if (forceOldest && !entries.length) entries = [...this.sessions.values()].filter((x) => x.consumers === 0).sort((a,b) => a.lastUsedAt-b.lastUsedAt).slice(0,1);
    for (const session of entries) { this.sessions.delete(session.key); await session.client.shutdown().catch(() => session.client.dispose()); }
    return entries.length;
  }
  snapshot() { const sessions = [...this.sessions.values()].map((x) => ({ languageId: x.languageId, workspaceRoot: x.workspaceRoot, consumers: x.consumers, createdAt: x.createdAt, lastUsedAt: x.lastUsedAt, definitionId: x.definitionId })); const base = { schema: 'forge.lsp-session-pool.v1', maxSessions: this.maxSessions, idleTtlMs: this.idleTtlMs, sessions: freeze(sessions) }; return freeze({ ...base, receiptSha256: canonicalSha256(base) }); }
  async close() { for (const session of [...this.sessions.values()]) { await session.client.shutdown().catch(() => session.client.dispose()); } this.sessions.clear(); }
}
