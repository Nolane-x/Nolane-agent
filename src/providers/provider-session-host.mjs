import { createHash, randomUUID } from 'node:crypto';

function clean(value, max = 256) { return String(value ?? '').trim().slice(0, max); }
function stable(value) { if (Array.isArray(value)) return value.map(stable); if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])); return value; }
function sha256(value) { return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex'); }
function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; for (const item of Object.values(value)) freeze(item); return Object.freeze(value); }
function stateOf(governor) { return clean(governor?.snapshot?.()?.state ?? 'normal', 64).toLowerCase() || 'normal'; }
function supportsSessions(provider) {
  if (!provider || typeof provider.openSession !== 'function' || typeof provider.completeInSession !== 'function') return false;
  const capabilities = typeof provider.sessionCapabilities === 'function' ? provider.sessionCapabilities() : {};
  return capabilities?.logicalSessions === true;
}
function scopeKey(provider, scope = {}) {
  const affinity = [provider.id, scope.projectId, scope.missionId, scope.repositoryId, scope.workspaceHash].map((value) => clean(value, 256) || '-');
  return affinity.join(':');
}

export class ProviderSessionHost {
  constructor({ governor, processLedger = null, clock = () => Date.now(), idleTtlMs = 120_000, maxUses = 32, maxSessions = 8, maxJournal = 1_000, eventSink = () => {} } = {}) {
    if (!governor?.snapshot) throw new TypeError('governor with snapshot() is required');
    if (processLedger !== null && (typeof processLedger?.register !== 'function' || typeof processLedger?.finalize !== 'function')) throw new TypeError('processLedger must expose register() and finalize()');
    this.governor = governor;
    this.processLedger = processLedger;
    this.clock = clock;
    this.idleTtlMs = Math.max(0, Number(idleTtlMs) || 0);
    this.maxUses = Math.max(1, Math.floor(Number(maxUses) || 32));
    this.maxSessions = Math.max(1, Math.floor(Number(maxSessions) || 8));
    this.maxJournal = Math.max(1, Math.floor(Number(maxJournal) || 1_000));
    this.eventSink = typeof eventSink === 'function' ? eventSink : () => {};
    this.sessions = new Map();
    this.journal = [];
    this.closed = false;
  }

  #event(type, detail = {}) {
    const base = { schema: 'forge.provider-session-event.v1', type, atMs: this.clock(), ...detail };
    const event = freeze({ ...base, receiptSha256: sha256(base) });
    this.journal.push(event);
    if (this.journal.length > this.maxJournal) this.journal.splice(0, this.journal.length - this.maxJournal);
    try { void this.eventSink(event); } catch {}
    return event;
  }

  #sessionView(record) {
    return freeze({ id: record.id, key: record.key, providerId: record.provider.id, fingerprintSha256: sha256(record.fingerprint), uses: record.uses, active: record.active, createdAtMs: record.createdAtMs, lastUsedAtMs: record.lastUsedAtMs, state: record.state, providerSessionId: clean(record.providerSession?.id ?? record.providerSession?.threadId, 256) || null });
  }

  async #closeRecord(record, reason) {
    if (!record || record.state === 'closed') return false;
    record.state = 'closing';
    try { await record.provider.closeSession?.(record.providerSession, { reason }); }
    finally {
      if (record.ledgerEntryId && this.processLedger) { try { this.processLedger.finalize(record.ledgerEntryId, reason); } catch {} record.ledgerEntryId = null; }
      record.state = 'closed';
      this.sessions.delete(record.key);
      this.#event(reason === 'fingerprint-changed' || reason === 'max-uses' ? 'provider-session.invalidated' : 'provider-session.evicted', { sessionId: record.id, key: record.key, providerId: record.provider.id, missionId: record.scope.missionId ?? null, reason, uses: record.uses });
    }
    return true;
  }

  async #evictOldestIdle(reason = 'capacity') {
    const candidate = [...this.sessions.values()].filter((item) => item.active === 0).sort((a, b) => a.lastUsedAtMs - b.lastUsedAtMs || a.id.localeCompare(b.id))[0];
    return candidate ? this.#closeRecord(candidate, reason) : false;
  }

  async complete({ provider, request = {}, scope = {}, fingerprint = '', signal = null } = {}) {
    if (this.closed) throw Object.assign(new Error('Provider session host is closed'), { code: 'PROVIDER_SESSION_HOST_CLOSED' });
    if (!provider?.id || typeof provider.complete !== 'function') throw new TypeError('provider with id and complete() is required');
    const normalizedFingerprint = clean(fingerprint, 2_000);
    const pressureState = stateOf(this.governor);
    const sessionCapable = supportsSessions(provider);
    const pressureBlocksWarm = ['pressure', 'brownout', 'emergency'].includes(pressureState);
    if (!sessionCapable || pressureBlocksWarm) {
      const result = await provider.complete({ ...request, signal: request.signal ?? signal });
      const mode = sessionCapable && pressureBlocksWarm ? 'one-shot-pressure' : 'one-shot';
      const receipt = this.#event('provider-session.one-shot', { providerId: provider.id, missionId: clean(scope.missionId) || null, taskId: clean(scope.taskId) || null, mode, governorState: pressureState });
      return freeze({ ...result, sessionHost: freeze({ schema: 'forge.provider-session-result.v1', mode, reused: false, sessionId: null, governorState: pressureState, receiptSha256: receipt.receiptSha256 }) });
    }

    const key = scopeKey(provider, scope);
    let record = this.sessions.get(key);
    let reused = Boolean(record);
    if (record && record.fingerprint !== normalizedFingerprint) { await this.#closeRecord(record, 'fingerprint-changed'); record = null; reused = false; }
    if (record && record.uses >= this.maxUses) { await this.#closeRecord(record, 'max-uses'); record = null; reused = false; }
    if (!record) {
      while (this.sessions.size >= this.maxSessions && await this.#evictOldestIdle('capacity')) {}
      if (this.sessions.size >= this.maxSessions) {
        const result = await provider.complete({ ...request, signal: request.signal ?? signal });
        const receipt = this.#event('provider-session.one-shot', { providerId: provider.id, missionId: clean(scope.missionId) || null, taskId: clean(scope.taskId) || null, mode: 'one-shot-capacity', governorState: pressureState });
        return freeze({ ...result, sessionHost: freeze({ schema: 'forge.provider-session-result.v1', mode: 'one-shot-capacity', reused: false, sessionId: null, governorState: pressureState, receiptSha256: receipt.receiptSha256 }) });
      }
      const providerSession = await provider.openSession({ scope: freeze(structuredClone(scope ?? {})), fingerprint: normalizedFingerprint, signal });
      const now = this.clock();
      record = { id: randomUUID(), key, provider, providerSession, scope: freeze(structuredClone(scope ?? {})), fingerprint: normalizedFingerprint, uses: 0, active: 0, state: 'ready', createdAtMs: now, lastUsedAtMs: now, ledgerEntryId: null };
      if (this.processLedger && typeof provider.processDescriptor === 'function') {
        const descriptor = await provider.processDescriptor();
        if (Number.isInteger(Number(descriptor?.rootPid)) && Number(descriptor.rootPid) > 0) {
          const ledgerEntry = this.processLedger.register({
            rootPid: Number(descriptor.rootPid), projectId: scope.projectId ?? null, missionId: scope.missionId ?? null,
            taskId: scope.taskId ?? null, providerId: provider.id, sessionId: clean(providerSession?.id ?? providerSession?.threadId) || null,
            metadata: descriptor.metadata ?? { runtimeKind: descriptor.runtimeKind, kind: descriptor.state },
          });
          record.ledgerEntryId = ledgerEntry.id;
        }
      }
      this.sessions.set(key, record);
      this.#event('provider-session.opened', { sessionId: record.id, key, providerId: provider.id, missionId: clean(scope.missionId) || null, taskId: clean(scope.taskId) || null, providerSessionId: clean(providerSession?.id ?? providerSession?.threadId) || null });
    }

    record.active += 1; record.state = 'active';
    try {
      const result = await provider.completeInSession(record.providerSession, { ...request, signal: request.signal ?? signal });
      record.uses += 1; record.lastUsedAtMs = this.clock();
      const receipt = this.#event('provider-session.completed', { sessionId: record.id, providerId: provider.id, missionId: clean(scope.missionId) || null, taskId: clean(scope.taskId) || null, reused, uses: record.uses });
      return freeze({ ...result, sessionHost: freeze({ schema: 'forge.provider-session-result.v1', mode: 'logical-session', reused, sessionId: record.id, providerSessionId: clean(record.providerSession?.id ?? record.providerSession?.threadId) || null, uses: record.uses, governorState: pressureState, receiptSha256: receipt.receiptSha256 }) });
    } finally {
      record.active = Math.max(0, record.active - 1); record.state = record.active ? 'active' : 'ready'; record.lastUsedAtMs = this.clock();
    }
  }

  async sweep() {
    const now = this.clock(); let evicted = 0;
    for (const record of [...this.sessions.values()]) if (record.active === 0 && now - record.lastUsedAtMs >= this.idleTtlMs) evicted += await this.#closeRecord(record, 'idle-ttl') ? 1 : 0;
    return freeze({ schema: 'forge.provider-session-sweep.v1', evicted, remaining: this.sessions.size });
  }

  async applyGovernorState() {
    const state = stateOf(this.governor); let evicted = 0;
    if (['pressure', 'brownout', 'emergency'].includes(state)) for (const record of [...this.sessions.values()]) if (record.active === 0) evicted += await this.#closeRecord(record, `governor-${state}`) ? 1 : 0;
    const base = { schema: 'forge.provider-session-governor-application.v1', state, evicted, remaining: this.sessions.size };
    return freeze({ ...base, receiptSha256: sha256(base) });
  }

  snapshot() {
    const base = { schema: 'forge.provider-session-host-snapshot.v1', governorState: stateOf(this.governor), sessions: [...this.sessions.values()].map((record) => this.#sessionView(record)).sort((a, b) => a.id.localeCompare(b.id)), journal: [...this.journal], closed: this.closed };
    return freeze({ ...base, receiptSha256: sha256(base) });
  }

  async close() {
    if (this.closed) return this.snapshot();
    for (const record of [...this.sessions.values()]) await this.#closeRecord(record, 'host-closed');
    this.closed = true;
    this.#event('provider-session.host-closed', { remaining: this.sessions.size });
    return this.snapshot();
  }
}
