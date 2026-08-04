import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile } from 'node:fs/promises';
import path from 'node:path';
import { canonicalJson } from '../update/canonical-json.mjs';
import { SessionReplay } from './session-replay.mjs';

function fail(code, message) {
  const error = new Error(`${code}: ${message}`);
  error.code = code;
  throw error;
}

function validId(value, field) {
  const text = String(value ?? '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(text)) fail('SESSION_LEDGER_ID', `Invalid ${field}: ${text || '<empty>'}`);
  return text;
}

function sha256(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : canonicalJson(value)).digest('hex');
}

function frozen(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) { value.forEach(frozen); return Object.freeze(value); }
  Object.values(value).forEach(frozen);
  return Object.freeze(value);
}

function eventHash(event) {
  const { hash, ...body } = event;
  return sha256(body);
}

export class SessionLedger {
  static async open({ directory, sessionId, signer = null } = {}) {
    const id = validId(sessionId, 'sessionId');
    const root = path.resolve(directory);
    await mkdir(root, { recursive: true, mode: 0o700 });
    const ledger = new SessionLedger({ directory: root, sessionId: id, signer });
    const report = await ledger.verify();
    ledger.lastSeq = report.events;
    ledger.lastHash = report.lastHash;
    const events = await ledger.readAll();
    ledger.#restoreCursor(events);
    return ledger;
  }

  constructor({ directory, sessionId, signer }) {
    this.directory = directory;
    this.sessionId = sessionId;
    this.file = path.join(directory, `${sessionId}.jsonl`);
    this.signer = signer;
    this.lastSeq = 0;
    this.lastHash = '0'.repeat(64);
    this.currentBranchId = 'main';
    this.currentCursorSeq = 0;
    this.writeQueue = Promise.resolve();
  }

  #restoreCursor(events) {
    this.currentBranchId = 'main';
    this.currentCursorSeq = 0;
    for (const event of events) {
      if (event.type === 'session.rewind') {
        this.currentBranchId = event.data.newBranchId;
        this.currentCursorSeq = event.data.targetSeq;
      } else if (event.branchId === this.currentBranchId) {
        this.currentCursorSeq = event.seq;
      }
    }
  }

  async readAll() {
    let content = '';
    try { content = await readFile(this.file, 'utf8'); } catch (error) {
      if (error.code === 'ENOENT') return Object.freeze([]);
      throw error;
    }
    const events = [];
    for (const [index, line] of content.split('\n').entries()) {
      if (!line.trim()) continue;
      try { events.push(JSON.parse(line)); } catch (error) { fail('SESSION_LEDGER_CORRUPT', `Invalid JSON at sequence ${index + 1}: ${error.message}`); }
    }
    return Object.freeze(events);
  }

  async verify() {
    const events = await this.readAll();
    let previousHash = '0'.repeat(64);
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      const expectedSeq = index + 1;
      if (event.seq !== expectedSeq) fail('SESSION_LEDGER_CORRUPT', `Unexpected sequence ${event.seq}; expected sequence ${expectedSeq}`);
      if (event.sessionId !== this.sessionId) fail('SESSION_LEDGER_CORRUPT', `Wrong session at sequence ${expectedSeq}`);
      if (event.previousHash !== previousHash) fail('SESSION_LEDGER_CORRUPT', `Broken previous hash at sequence ${expectedSeq}`);
      if (event.parentSeq < 0 || event.parentSeq >= event.seq) fail('SESSION_LEDGER_CORRUPT', `Invalid parent at sequence ${expectedSeq}`);
      const expectedHash = eventHash(event);
      if (event.hash !== expectedHash) fail('SESSION_LEDGER_CORRUPT', `Invalid hash at sequence ${expectedSeq}`);
      previousHash = event.hash;
    }
    return Object.freeze({ schema: 'forge.session-ledger-verification.v1', valid: true, events: events.length, lastHash: previousHash });
  }

  async append(type, data = {}, { branchId = this.currentBranchId, parentSeq = this.currentCursorSeq } = {}) {
    const operation = async () => {
      const seq = this.lastSeq + 1;
      const body = {
        schema: 'forge.session-event.v1', sessionId: this.sessionId, seq, branchId: validId(branchId, 'branchId'),
        parentSeq: Number(parentSeq) || 0, type: String(type).slice(0, 128), data: structuredClone(data),
        at: new Date().toISOString(), previousHash: this.lastHash,
      };
      if (!body.type) fail('SESSION_LEDGER_TYPE', 'Event type is required');
      if (body.parentSeq < 0 || body.parentSeq >= seq) fail('SESSION_LEDGER_PARENT', `Invalid parent sequence ${body.parentSeq}`);
      const event = frozen({ ...body, hash: eventHash(body) });
      const handle = await open(this.file, 'a', 0o600);
      try { await handle.writeFile(`${JSON.stringify(event)}\n`, 'utf8'); await handle.sync(); } finally { await handle.close(); }
      this.lastSeq = seq;
      this.lastHash = event.hash;
      if (event.branchId === this.currentBranchId) this.currentCursorSeq = event.seq;
      return event;
    };
    const pending = this.writeQueue.then(operation, operation);
    this.writeQueue = pending.then(() => undefined, () => undefined);
    return await pending;
  }

  async checkpoint({ repository = {}, task = {}, plan = {}, context = {}, receipts = [] } = {}) {
    const state = { repository, task, plan, context, receipts: [...receipts].map(String) };
    const stateDigest = sha256(state);
    const signature = this.signer?.sign ? await this.signer.sign(stateDigest) : null;
    return await this.append('session.checkpoint', { stateDigest, signature, repository, task, plan, context, receiptDigests: state.receipts });
  }

  async rewind(targetSeq, { reason = '' } = {}) {
    const events = await this.readAll();
    const target = events.find((event) => event.seq === Number(targetSeq));
    if (!target || target.type !== 'session.checkpoint') fail('SESSION_REWIND_TARGET', `Sequence ${targetSeq} is not a checkpoint`);
    const newBranchId = `rewind-${randomUUID()}`;
    const event = await this.append('session.rewind', { targetSeq: target.seq, targetHash: target.hash, newBranchId, reason: String(reason).slice(0, 2000) });
    this.currentBranchId = newBranchId;
    this.currentCursorSeq = target.seq;
    return event;
  }

  async replayCurrent({ initialState, reducer }) {
    return SessionReplay.materialize(await this.readAll(), { cursorSeq: this.currentCursorSeq, initialState, reducer });
  }

  async fork({ newSessionId, targetSeq = this.currentCursorSeq } = {}) {
    await this.verify();
    const events = await this.readAll();
    const source = events.find((event) => event.seq === Number(targetSeq));
    if (!source) fail('SESSION_FORK_TARGET', `Unknown source sequence ${targetSeq}`);
    const fork = await SessionLedger.open({ directory: this.directory, sessionId: newSessionId, signer: this.signer });
    if ((await fork.readAll()).length) fail('SESSION_FORK_EXISTS', `Target session ${newSessionId} already has events`);
    await fork.append('session.forked', { sourceSessionId: this.sessionId, sourceSeq: source.seq, sourceHash: source.hash }, { branchId: 'main', parentSeq: 0 });
    return fork;
  }
}
