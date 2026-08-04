import { mkdir, readFile, writeFile, rename, copyFile, access } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const stable = (value) => JSON.stringify(value, Object.keys(value).sort());

function encodeEnvelope(data) {
  const payload = JSON.stringify(data);
  return JSON.stringify({ schema: 'nolane.agent.sessions.v1', checksum: sha256(payload), payload: data }, null, 2) + '\n';
}

function decodeEnvelope(raw) {
  const envelope = JSON.parse(raw);
  if (envelope.schema !== 'nolane.agent.sessions.v1') throw new Error('invalid session schema');
  const payload = JSON.stringify(envelope.payload);
  if (sha256(payload) !== envelope.checksum) throw new Error('session checksum mismatch');
  return envelope.payload;
}

export class NolaneSessionStore {
  constructor({ root } = {}) {
    if (!root) throw new TypeError('root is required');
    this.root = path.resolve(root);
    this.primary = path.join(this.root, 'sessions.json');
    this.backup = path.join(this.root, 'sessions.json.bak');
    this.state = { sessions: [] };
    this.writeChain = Promise.resolve();
  }

  async open() {
    await mkdir(this.root, { recursive: true });
    try {
      this.state = this.#normalizeState(decodeEnvelope(await readFile(this.primary, 'utf8')));
      return { recoveredFromBackup: false, sessionCount: this.state.sessions.length };
    } catch (primaryError) {
      try {
        this.state = this.#normalizeState(decodeEnvelope(await readFile(this.backup, 'utf8')));
        await this.#writePrimaryOnly();
        return { recoveredFromBackup: true, sessionCount: this.state.sessions.length };
      } catch (backupError) {
        if (primaryError?.code !== 'ENOENT') {
          const combined = new Error('session store is corrupt and no valid backup exists');
          combined.cause = { primaryError, backupError };
          throw combined;
        }
        this.state = { sessions: [] };
        await this.#writePrimaryOnly();
        return { recoveredFromBackup: false, created: true, sessionCount: 0 };
      }
    }
  }

  async createSession({ id, title, projectId, profileId = 'default', parentSessionId = null }) {
    if (!id || !title || !projectId || !profileId) throw new Error('session id, title, projectId and profileId are required');
    if (this.state.sessions.some((session) => session.id === id)) throw new Error(`session already exists: ${id}`);
    if (parentSessionId !== null) {
      const parent = this.state.sessions.find((session) => session.id === parentSessionId);
      if (!parent) throw new Error(`unknown parent session: ${parentSessionId}`);
      if (parent.projectId !== projectId || parent.profileId !== profileId) throw new Error('parent session scope mismatch');
    }
    const session = { id, title, projectId, profileId, parentSessionId, version: 1, messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await this.#mutate((draft) => draft.sessions.push(session));
    return structuredClone(session);
  }

  async appendMessage(sessionId, message, { expectedVersion = undefined, profileId = null } = {}) {
    if (!message?.id || !message?.role || typeof message.text !== 'string') throw new Error('message id, role and text are required');
    let result;
    await this.#mutate((draft) => {
      const session = draft.sessions.find((item) => item.id === sessionId);
      if (!session) throw new Error(`unknown session: ${sessionId}`);
      if (profileId !== null && session.profileId !== String(profileId)) throw new Error('session profile scope denied');
      if (expectedVersion !== undefined && Number(expectedVersion) !== Number(session.version)) throw new Error(`Session version conflict: expected ${expectedVersion}, actual ${session.version}`);
      if (session.messages.some((item) => item.id === message.id)) throw new Error(`message already exists: ${message.id}`);
      session.version += 1;
      result = { ...message, createdAt: new Date().toISOString(), sessionVersion: session.version };
      session.messages.push(result);
      session.updatedAt = result.createdAt;
    });
    return structuredClone(result);
  }

  getSession(id, { profileId = null } = {}) {
    const session = this.state.sessions.find((item) => item.id === id);
    if (!session) return null;
    if (profileId !== null && session.profileId !== String(profileId)) throw new Error('session profile scope denied');
    return structuredClone(session);
  }

  listSessions({ profileId = null } = {}) {
    return this.state.sessions
      .filter((session) => profileId === null || session.profileId === String(profileId))
      .map((session) => structuredClone(session));
  }

  lineage(id, { profileId = null } = {}) {
    const lineage = []; const seen = new Set(); let current = this.getSession(id, { profileId });
    if (!current) throw new Error(`unknown session: ${id}`);
    while (current) {
      if (seen.has(current.id)) throw new Error('session lineage cycle detected');
      seen.add(current.id); lineage.unshift(current);
      current = current.parentSessionId ? this.getSession(current.parentSessionId, { profileId }) : null;
    }
    return lineage;
  }

  compressSession(id, options) {
    const session = this.getSession(id);
    if (!session) throw new Error(`unknown session: ${id}`);
    return compressSessionHistory({ messages: session.messages, ...options });
  }

  search(query, { profileId = null } = {}) {
    const terms = String(query ?? '').toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];
    return this.state.sessions.filter((session) => profileId === null || session.profileId === String(profileId)).flatMap((session) => {
      const corpus = [session.title, session.projectId, ...session.messages.flatMap((message) => [message.role, message.text])].join(' ').toLowerCase();
      const matched = terms.filter((term) => corpus.includes(term));
      if (matched.length !== terms.length) return [];
      return [{ sessionId: session.id, title: session.title, score: matched.length, matchedTerms: matched }];
    }).sort((a, b) => b.score - a.score || a.sessionId.localeCompare(b.sessionId));
  }

  snapshot() { return Object.freeze({ schema: 'nolane.agent.session-store-snapshot.v1', sessions: this.state.sessions.length, profiles: [...new Set(this.state.sessions.map((entry) => entry.profileId))].sort(), root: this.root }); }

  #normalizeState(state) {
    return { sessions: (state?.sessions ?? []).map((session) => ({ profileId: 'default', parentSessionId: null, version: Math.max(1, Number(session.version ?? 1)), ...session })) };
  }

  async #mutate(mutator) {
    this.writeChain = this.writeChain.catch(() => {}).then(async () => {
      const draft = structuredClone(this.state);
      mutator(draft);
      await this.#persist(draft);
      this.state = draft;
    });
    return this.writeChain;
  }

  async #persist(nextState) {
    await mkdir(this.root, { recursive: true });
    const temp = `${this.primary}.tmp-${process.pid}-${Date.now()}`;
    try {
      await access(this.primary);
      await copyFile(this.primary, this.backup);
    } catch {}
    await writeFile(temp, encodeEnvelope(nextState), { mode: 0o600 });
    await rename(temp, this.primary);
  }

  async #writePrimaryOnly() {
    const temp = `${this.primary}.tmp-${process.pid}-${Date.now()}`;
    await writeFile(temp, encodeEnvelope(this.state), { mode: 0o600 });
    await rename(temp, this.primary);
  }
}

export function compressSessionHistory({ messages, maxCharacters, keepRecent = 3 }) {
  if (!Array.isArray(messages)) throw new TypeError('messages must be an array');
  if (!Number.isInteger(maxCharacters) || maxCharacters < 1) throw new TypeError('maxCharacters must be a positive integer');
  const recent = messages.slice(-Math.max(0, keepRecent)).map((message) => ({ id: message.id, role: message.role, text: message.text }));
  const older = messages.slice(0, Math.max(0, messages.length - recent.length));
  const recentCharacters = recent.reduce((sum, item) => sum + item.text.length, 0);
  const summaryBudget = Math.max(0, maxCharacters - recentCharacters);
  const source = older.map((item) => `[${item.id}:${item.role}] ${item.text}`).join('\n');
  const summary = source.length <= summaryBudget ? source : source.slice(0, Math.max(0, summaryBudget - 1)) + (summaryBudget > 0 ? '…' : '');
  const estimatedCharacters = Math.min(maxCharacters, summary.length + recentCharacters);
  return {
    schema: 'nolane.agent.session-compression.v1',
    totalMessages: messages.length,
    summarizedMessages: older.length,
    summary,
    summarySha256: sha256(summary),
    recent,
    estimatedCharacters,
    provenance: older.map((item) => item.id)
  };
}
