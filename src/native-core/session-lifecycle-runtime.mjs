import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const stable = (value) => JSON.stringify(value, Object.keys(value).sort());
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

function envelope(state) {
  const payload = JSON.stringify(state);
  return `${JSON.stringify({ schema: 'nolane.agent.session-lifecycle-store.v1', checksum: sha256(payload), payload: state }, null, 2)}\n`;
}

function decode(raw) {
  const parsed = JSON.parse(raw);
  if (parsed.schema !== 'nolane.agent.session-lifecycle-store.v1') throw new Error('invalid session lifecycle schema');
  if (sha256(JSON.stringify(parsed.payload)) !== parsed.checksum) throw new Error('session lifecycle checksum mismatch');
  return parsed.payload;
}

export class SessionLifecycleRuntime {
  constructor({ store, file, clock = () => Date.now(), maxInputHistory = 100, maxQueueItems = 100 } = {}) {
    if (!store || !file) throw new TypeError('store and file are required');
    this.store = store;
    this.file = path.resolve(file);
    this.clock = clock;
    this.maxInputHistory = maxInputHistory;
    this.maxQueueItems = maxQueueItems;
    this.state = { metadata: {}, inputHistory: {}, queues: {} };
    this.writeChain = Promise.resolve();
  }

  async open() {
    await mkdir(path.dirname(this.file), { recursive: true });
    try { this.state = decode(await readFile(this.file, 'utf8')); }
    catch (error) { if (error?.code !== 'ENOENT') throw error; await this.#persist(); }
    return this.snapshot();
  }

  async updateMetadata(sessionId, { profileId, expectedVersion = undefined, pinned = undefined, color = undefined, status = undefined } = {}) {
    const session = this.store.getSession(sessionId, { profileId });
    if (!session) throw new Error(`unknown session: ${sessionId}`);
    const current = this.state.metadata[sessionId] ?? { profileId: session.profileId, version: 0, pinned: false, color: null, status: 'idle', updatedAt: null };
    if (current.profileId !== session.profileId) throw new Error('session profile scope denied');
    if (expectedVersion !== undefined && Number(expectedVersion) !== current.version) throw new Error(`metadata version conflict: expected ${expectedVersion}, actual ${current.version}`);
    const next = { ...current, version: current.version + 1, pinned: pinned === undefined ? current.pinned : Boolean(pinned), color: color === undefined ? current.color : (color == null ? null : String(color)), status: status === undefined ? current.status : String(status), updatedAt: this.clock() };
    await this.#mutate((draft) => { draft.metadata[sessionId] = next; });
    return Object.freeze(structuredClone(next));
  }

  list({ profileId, query = '', pinned = undefined, status = undefined, limit = 100 } = {}) {
    const terms = String(query).toLowerCase().trim().split(/\s+/).filter(Boolean);
    const sessions = this.store.listSessions({ profileId });
    return sessions.map((session) => {
      const metadata = this.state.metadata[session.id] ?? { profileId: session.profileId, version: 0, pinned: false, color: null, status: 'idle', updatedAt: null };
      const corpus = [session.title, session.projectId, ...session.messages.flatMap((message) => [message.role, message.text])].join(' ').toLowerCase();
      const score = terms.reduce((sum, term) => sum + (corpus.includes(term) ? 1 : 0), 0);
      return { session, metadata, score };
    }).filter((entry) => terms.length === 0 || entry.score === terms.length)
      .filter((entry) => pinned === undefined || entry.metadata.pinned === Boolean(pinned))
      .filter((entry) => status === undefined || entry.metadata.status === String(status))
      .sort((a, b) => Number(b.metadata.pinned) - Number(a.metadata.pinned) || String(b.session.updatedAt).localeCompare(String(a.session.updatedAt)) || a.session.id.localeCompare(b.session.id))
      .slice(0, Math.max(1, Math.min(500, Number(limit) || 100)))
      .map((entry) => Object.freeze({ ...structuredClone(entry.session), metadata: structuredClone(entry.metadata), score: entry.score }));
  }

  async branch({ sourceSessionId, newSessionId, profileId, throughMessageId = null, title = null } = {}) {
    const source = this.store.getSession(sourceSessionId, { profileId });
    if (!source) throw new Error(`unknown session: ${sourceSessionId}`);
    let messages = source.messages;
    if (throughMessageId !== null) {
      const index = messages.findIndex((entry) => entry.id === throughMessageId);
      if (index < 0) throw new Error(`unknown message: ${throughMessageId}`);
      messages = messages.slice(0, index + 1);
    }
    await this.store.createSession({ id: newSessionId, title: title ?? `${source.title} branch`, projectId: source.projectId, profileId: source.profileId, parentSessionId: source.id });
    let expectedVersion = 1;
    for (const message of messages) {
      await this.store.appendMessage(newSessionId, { id: message.id, role: message.role, text: message.text }, { expectedVersion, profileId: source.profileId });
      expectedVersion += 1;
    }
    const receipt = { schema: 'nolane.agent.session-branch.v1', sourceSessionId, newSessionId, profileId: source.profileId, throughMessageId, messages: messages.length, createdAt: this.clock() };
    receipt.receiptSha256 = sha256(stable(receipt));
    return Object.freeze(receipt);
  }

  rewind({ sessionId, newSessionId, profileId, toMessageId } = {}) {
    return this.branch({ sourceSessionId: sessionId, newSessionId, profileId, throughMessageId: toMessageId, title: `${this.store.getSession(sessionId, { profileId })?.title ?? 'Session'} rewind` });
  }

  async pushInputHistory({ profileId, value } = {}) {
    const clean = String(value ?? '').trim();
    if (!profileId || !clean) throw new Error('profileId and non-empty history value are required');
    await this.#mutate((draft) => {
      const list = draft.inputHistory[profileId] ?? [];
      draft.inputHistory[profileId] = [...list.filter((entry) => entry !== clean), clean].slice(-this.maxInputHistory);
    });
    return this.inputHistory({ profileId });
  }

  inputHistory({ profileId } = {}) { return Object.freeze([...(this.state.inputHistory[String(profileId)] ?? [])]); }

  async enqueuePrompt({ sessionId, profileId, id, text } = {}) {
    const session = this.store.getSession(sessionId, { profileId });
    if (!session) throw new Error(`unknown session: ${sessionId}`);
    if (!id || !String(text ?? '').trim()) throw new Error('prompt id and text are required');
    await this.#mutate((draft) => {
      const queue = draft.queues[sessionId] ?? [];
      if (queue.some((entry) => entry.id === id)) throw new Error(`prompt already queued: ${id}`);
      if (queue.length >= this.maxQueueItems) throw new Error('prompt queue budget exceeded');
      draft.queues[sessionId] = [...queue, { id: String(id), text: String(text), profileId: session.profileId, createdAt: this.clock() }];
    });
    return Object.freeze([...(this.state.queues[sessionId] ?? [])]);
  }

  async drainPromptQueue({ sessionId, profileId, limit = 1 } = {}) {
    const session = this.store.getSession(sessionId, { profileId });
    if (!session) throw new Error(`unknown session: ${sessionId}`);
    const count = Math.max(1, Math.min(this.maxQueueItems, Number(limit) || 1));
    let drained = [];
    await this.#mutate((draft) => {
      const queue = draft.queues[sessionId] ?? [];
      drained = queue.slice(0, count);
      draft.queues[sessionId] = queue.slice(count);
    });
    return Object.freeze(structuredClone(drained));
  }

  exportSession({ sessionId, profileId, format = 'json' } = {}) {
    const session = this.store.getSession(sessionId, { profileId });
    if (!session) throw new Error(`unknown session: ${sessionId}`);
    let content; let mediaType;
    if (format === 'json') { content = JSON.stringify({ schema: 'nolane.agent.session-export.v1', session }, null, 2); mediaType = 'application/json'; }
    else if (format === 'markdown') { content = `# ${session.title}\n\n${session.messages.map((message) => `## ${message.role}\n\n${message.text}`).join('\n\n')}\n`; mediaType = 'text/markdown'; }
    else if (format === 'html') { content = `<!doctype html><meta charset="utf-8"><title>${escapeHtml(session.title)}</title><h1>${escapeHtml(session.title)}</h1>${session.messages.map((message) => `<section><h2>${escapeHtml(message.role)}</h2><pre>${escapeHtml(message.text)}</pre></section>`).join('')}`; mediaType = 'text/html'; }
    else throw new Error(`unsupported export format: ${format}`);
    const receipt = { schema: 'nolane.agent.session-export-receipt.v1', sessionId, profileId: session.profileId, format, mediaType, bytes: Buffer.byteLength(content), contentSha256: sha256(content) };
    receipt.receiptSha256 = sha256(stable(receipt));
    return Object.freeze({ ...receipt, content });
  }

  snapshot() { return Object.freeze({ schema: 'nolane.agent.session-lifecycle-runtime-snapshot.v1', metadata: Object.keys(this.state.metadata).length, profilesWithHistory: Object.keys(this.state.inputHistory).length, queuedPrompts: Object.values(this.state.queues).reduce((sum, entries) => sum + entries.length, 0) }); }

  async #mutate(mutator) { this.writeChain = this.writeChain.catch(() => {}).then(async () => { const draft = structuredClone(this.state); mutator(draft); this.state = draft; await this.#persist(); }); return this.writeChain; }
  async #persist() { await mkdir(path.dirname(this.file), { recursive: true }); const temp = `${this.file}.tmp-${process.pid}-${Date.now()}`; await writeFile(temp, envelope(this.state), { mode: 0o600 }); await rename(temp, this.file); }
}
