import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
};
const receipt = (value) => Object.freeze({ ...value, receiptSha256: sha256(JSON.stringify(canonical(value))) });
const clone = (value) => structuredClone(value);
const publicMessage = (message) => ({ id: String(message.id), role: String(message.role), text: String(message.text), visibility: message.visibility === 'hidden' ? 'hidden' : 'public' });

export class SessionStreamCoordinator {
  constructor({ file } = {}) {
    if (!file) throw new TypeError('file is required');
    this.file = path.resolve(file);
    this.state = { sessions: {} };
    this.work = new Map();
    this.writeChain = Promise.resolve();
  }
  async open() {
    await mkdir(path.dirname(this.file), { recursive: true });
    try {
      const envelope = JSON.parse(await readFile(this.file, 'utf8'));
      const payload = JSON.stringify(envelope.payload);
      if (envelope.schema !== 'nolane.session-stream-store.v1' || sha256(payload) !== envelope.checksum) throw new Error('session stream checksum mismatch');
      this.state = envelope.payload;
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      await this.#persist();
    }
    return this.snapshot();
  }
  append(sessionId, message) { return this.appendMany(sessionId, [message]); }
  async appendMany(sessionId, messages) {
    const id = String(sessionId ?? '');
    if (!id || !Array.isArray(messages)) throw new TypeError('sessionId and messages are required');
    await this.#mutate((draft) => {
      const session = draft.sessions[id] ?? { messages: [], version: 0 };
      const ids = new Set(session.messages.map((entry) => entry.id));
      for (const input of messages) {
        const message = publicMessage(input);
        if (!message.id || !message.role || ids.has(message.id)) throw Object.assign(new Error(`duplicate or invalid message: ${message.id}`), { code: 'MESSAGE_CONFLICT' });
        ids.add(message.id); session.messages.push(message); session.version += 1;
      }
      draft.sessions[id] = session;
    });
    return this.resume(id);
  }
  resume(sessionId, { after = 0, limit = Infinity } = {}) {
    const session = this.state.sessions[String(sessionId)] ?? { messages: [], version: 0 };
    const messages = session.messages.filter((entry) => entry.visibility !== 'hidden').slice(Math.max(0, Number(after) || 0), Number.isFinite(limit) ? Math.max(0, Number(limit)) : undefined);
    return Object.freeze({ schema: 'nolane.session-public-stream.v1', sessionId: String(sessionId), version: session.version, messages: clone(messages) });
  }
  trackWork(sessionId, { id, controller } = {}) {
    if (!id || !controller?.abort) throw new TypeError('work id and AbortController are required');
    const key = String(sessionId); const entries = this.work.get(key) ?? new Map();
    entries.set(String(id), controller); this.work.set(key, entries);
    return Object.freeze({ sessionId: key, workId: String(id), tracked: true });
  }
  async stop(sessionId, reason = 'stopped') {
    const key = String(sessionId); const entries = this.work.get(key) ?? new Map();
    for (const controller of entries.values()) controller.abort(reason);
    this.work.delete(key);
    return receipt({ schema: 'nolane.session-stop-receipt.v1', sessionId: key, cancelled: entries.size, reason: String(reason) });
  }
  snapshot() { return Object.freeze({ schema: 'nolane.session-stream-coordinator.v1', sessions: Object.keys(this.state.sessions).length, publicMessages: Object.values(this.state.sessions).reduce((sum, entry) => sum + entry.messages.filter((message) => message.visibility !== 'hidden').length, 0), activeWork: [...this.work.values()].reduce((sum, entry) => sum + entry.size, 0) }); }
  async #mutate(mutator) { this.writeChain = this.writeChain.catch(() => {}).then(async () => { const draft = clone(this.state); mutator(draft); this.state = draft; await this.#persist(); }); return this.writeChain; }
  async #persist() { const payload = JSON.stringify(this.state); const envelope = `${JSON.stringify({ schema: 'nolane.session-stream-store.v1', checksum: sha256(payload), payload: this.state })}\n`; const temp = `${this.file}.tmp-${process.pid}-${Date.now()}`; await mkdir(path.dirname(this.file), { recursive: true }); await writeFile(temp, envelope, { mode: 0o600 }); await rename(temp, this.file); }
}

export class SessionWindowLeaseRegistry {
  constructor({ clock = () => Date.now() } = {}) { this.clock = clock; this.leases = new Map(); }
  acquire({ sessionId, windowId, ttlMs = 30_000 } = {}) {
    const key = String(sessionId); const owner = String(windowId); const now = Number(this.clock()); const current = this.leases.get(key);
    if (!key || !owner || !Number.isFinite(Number(ttlMs)) || Number(ttlMs) < 1) throw new TypeError('sessionId, windowId and positive ttlMs are required');
    if (current && current.expiresAt > now && current.owner !== owner) throw Object.assign(new Error(`Session ${key} is owned by ${current.owner}`), { code: 'LEASE_CONFLICT', statusCode: 409, owner: current.owner });
    const lease = { sessionId: key, owner, version: (current?.version ?? 0) + 1, expiresAt: now + Number(ttlMs) }; this.leases.set(key, lease); return Object.freeze(clone(lease));
  }
  heartbeat({ sessionId, windowId, ttlMs = 30_000 } = {}) { const current = this.leases.get(String(sessionId)); if (!current || current.owner !== String(windowId)) throw Object.assign(new Error('Lease ownership denied'), { code: 'LEASE_OWNERSHIP_DENIED' }); return this.acquire({ sessionId, windowId, ttlMs }); }
  release({ sessionId, windowId } = {}) { const key = String(sessionId); const current = this.leases.get(key); const released = Boolean(current && current.owner === String(windowId)); if (released) this.leases.delete(key); return Object.freeze({ sessionId: key, released }); }
  snapshot() { const now = Number(this.clock()); return Object.freeze({ schema: 'nolane.session-window-leases.v1', active: [...this.leases.values()].filter((entry) => entry.expiresAt > now).length }); }
}

export class SessionCompressionService {
  compress({ sessionId, messages, maxCharacters, keepRecent = 3 } = {}) {
    if (!Array.isArray(messages) || !Number.isInteger(maxCharacters) || maxCharacters < 1) throw new TypeError('messages and positive maxCharacters are required');
    const visible = messages.map(publicMessage).filter((entry) => entry.visibility !== 'hidden');
    const recent = visible.slice(-Math.max(0, Number(keepRecent) || 0));
    const older = visible.slice(0, visible.length - recent.length);
    const recentText = recent.map((entry) => entry.text).join('\n');
    const source = older.map((entry) => `[${entry.id}:${entry.role}] ${entry.text}`).join('\n');
    const budget = Math.max(0, maxCharacters - recentText.length);
    const summary = source.length <= budget ? source : `${source.slice(0, Math.max(0, budget - 1))}${budget ? '…' : ''}`;
    return receipt({ schema: 'nolane.session-compression-lineage.v1', sessionId: String(sessionId), summary, summarySha256: sha256(summary), recent: clone(recent), lineage: visible.map((entry) => entry.id), sourceSha256: sha256(JSON.stringify(canonical(visible))), estimatedCharacters: Math.min(maxCharacters, summary.length + recentText.length) });
  }
}

export class ConversationCorrectionService {
  constructor({ messages = [] } = {}) { this.messages = messages.map(publicMessage); this.history = []; }
  correct({ messageId, replacement } = {}) {
    const index = this.messages.findIndex((entry) => entry.id === String(messageId));
    if (index < 0) throw Object.assign(new Error('Message not found'), { code: 'MESSAGE_NOT_FOUND' });
    if (this.messages[index].visibility === 'hidden') throw Object.assign(new Error('Hidden messages cannot be corrected'), { code: 'HIDDEN_MESSAGE_DENIED' });
    const before = clone(this.messages[index]); const after = { ...before, text: String(replacement) };
    this.messages[index] = after; this.history.push({ index, before, after });
    return receipt({ schema: 'nolane.conversation-correction.v1', message: clone(after), revision: this.history.length });
  }
  undo() { const item = this.history.pop(); if (!item) throw Object.assign(new Error('Nothing to undo'), { code: 'UNDO_EMPTY' }); this.messages[item.index] = item.before; return receipt({ schema: 'nolane.conversation-correction-undo.v1', message: clone(item.before), revision: this.history.length }); }
  publicMessages() { return Object.freeze(this.messages.filter((entry) => entry.visibility !== 'hidden').map(clone)); }
}

export class SessionContextDriftEngine {
  compare({ baseline = {}, current = {} } = {}) {
    const normalized = (value) => JSON.stringify(canonical(value));
    const changedFields = [...new Set([...Object.keys(baseline), ...Object.keys(current)])].filter((key) => normalized(baseline[key]) !== normalized(current[key])).sort();
    const suggestions = changedFields.map((field) => Object.freeze({ field, action: field === 'cwd' ? 'confirm-working-directory' : field === 'model' ? 'confirm-model' : 'refresh-context' }));
    return receipt({ schema: 'nolane.session-context-drift.v1', changedFields, suggestions, drifted: changedFields.length > 0 });
  }
}

export class SessionVirtualListModel {
  constructor({ items = [] } = {}) { this.items = items.map((entry, index) => ({ ...clone(entry), id: String(entry.id), pinned: Boolean(entry.pinned), archived: Boolean(entry.archived), order: index })); }
  #require(id) { const item = this.items.find((entry) => entry.id === String(id)); if (!item) throw new Error(`unknown session item: ${id}`); return item; }
  pin(id, value) { this.#require(id).pinned = Boolean(value); return this.snapshot(); }
  archive(id, value) { this.#require(id).archived = Boolean(value); return this.snapshot(); }
  reorder(id, targetIndex) { const index = this.items.findIndex((entry) => entry.id === String(id)); if (index < 0) throw new Error(`unknown session item: ${id}`); const [item] = this.items.splice(index, 1); this.items.splice(Math.max(0, Math.min(this.items.length, Number(targetIndex) || 0)), 0, item); this.items.forEach((entry, order) => { entry.order = order; }); return this.snapshot(); }
  window({ start = 0, count = 50 } = {}) { const visible = this.items.filter((entry) => !entry.archived).sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.order - b.order || a.id.localeCompare(b.id)); return Object.freeze({ schema: 'nolane.session-virtual-window.v1', total: visible.length, start: Math.max(0, Number(start) || 0), items: clone(visible.slice(Math.max(0, Number(start) || 0), Math.max(0, Number(start) || 0) + Math.max(0, Number(count) || 0))) }); }
  snapshot() { return Object.freeze({ schema: 'nolane.session-virtual-list.v1', total: this.items.length, archived: this.items.filter((entry) => entry.archived).length, pinned: this.items.filter((entry) => entry.pinned && !entry.archived).length }); }
}

export class SessionTerminalBinding {
  constructor() { this.bindings = new Map(); }
  bind({ sessionId, terminalId, windowId } = {}) { const key = String(sessionId); const current = this.bindings.get(key); if (current && current.windowId !== String(windowId)) throw Object.assign(new Error('Session terminal is already owned by another window'), { code: 'TERMINAL_BINDING_CONFLICT' }); const binding = { sessionId: key, terminalId: String(terminalId), windowId: String(windowId) }; this.bindings.set(key, binding); return Object.freeze(clone(binding)); }
  unbind({ sessionId, windowId } = {}) { const key = String(sessionId); const current = this.bindings.get(key); const released = Boolean(current && current.windowId === String(windowId)); if (released) this.bindings.delete(key); return Object.freeze({ sessionId: key, released }); }
  snapshot() { return Object.freeze({ schema: 'nolane.session-terminal-bindings.v1', bindings: this.bindings.size }); }
}

export class SessionProductRuntimeWave8 {
  constructor({ dataDir, clock = () => Date.now() } = {}) {
    if (!dataDir) throw new TypeError('dataDir is required');
    this.stream = new SessionStreamCoordinator({ file: path.join(path.resolve(dataDir), 'session-streams.json') });
    this.leases = new SessionWindowLeaseRegistry({ clock });
    this.compression = new SessionCompressionService();
    this.drift = new SessionContextDriftEngine();
    this.terminals = new SessionTerminalBinding();
    this.virtualLists = new Map();
  }
  open() { return this.stream.open(); }
  virtualList(profileId = 'default', items = []) { const key = String(profileId); if (!this.virtualLists.has(key)) this.virtualLists.set(key, new SessionVirtualListModel({ items })); return this.virtualLists.get(key); }
  snapshot() { const stream = this.stream.snapshot(); return Object.freeze({ schema: 'nolane.session-product-runtime-wave8.v1', sessions: stream.sessions, publicMessages: stream.publicMessages, activeWork: stream.activeWork, leases: this.leases.snapshot(), terminals: this.terminals.snapshot(), virtualLists: this.virtualLists.size }); }
}
