import { randomUUID } from 'node:crypto';
export class StreamableHttpSessionStore {
  constructor({ maxEvents = 1000, ttlMs = 30*60_000, clock = () => Date.now() } = {}) { this.maxEvents = Math.max(1, maxEvents); this.ttlMs = Math.max(100, ttlMs); this.clock = clock; this.sessions = new Map(); }
  create({ organizationId, workspaceId, subject } = {}) { const id = randomUUID(); this.sessions.set(id, { id, organizationId: String(organizationId), workspaceId: String(workspaceId), subject: String(subject), createdAt: this.clock(), touchedAt: this.clock(), nextEventId: 1, events: [] }); return id; }
  #get(input) { const session = this.sessions.get(String(input.sessionId)); if (!session || session.organizationId !== String(input.organizationId) || session.workspaceId !== String(input.workspaceId) || this.clock() - session.touchedAt > this.ttlMs) { if (session && this.clock() - session.touchedAt > this.ttlMs) this.sessions.delete(session.id); throw Object.assign(new Error('MCP session not found'), { statusCode: 404, code: 'mcp-session-not-found' }); } session.touchedAt = this.clock(); return session; }
  append(input = {}) { const session = this.#get(input); const event = Object.freeze({ id: session.nextEventId++, type: String(input.type ?? 'message'), data: structuredClone(input.data), at: this.clock() }); session.events.push(event); if (session.events.length > this.maxEvents) session.events.splice(0, session.events.length - this.maxEvents); return event; }
  read(input = {}) { const session = this.#get(input); const after = Number(input.afterEventId ?? 0); return session.events.filter((event) => event.id > after).map((event) => structuredClone(event)); }
  close(input = {}) { const session = this.#get(input); this.sessions.delete(session.id); }
}
