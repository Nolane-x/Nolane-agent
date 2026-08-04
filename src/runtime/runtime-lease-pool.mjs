import { createHash, randomUUID } from 'node:crypto';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}

function sha256(value) {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function clean(value, max = 512) {
  return String(value ?? '').trim().slice(0, max);
}

function frozen(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) { value.forEach(frozen); return Object.freeze(value); }
  Object.values(value).forEach(frozen);
  return Object.freeze(value);
}

export class RuntimeLeasePool {
  constructor({ kind, governor, policyKey, maxGlobal = Infinity, maxPerKey = 1, idleTtlMs = 30_000, maxJournal = 500, clock = () => Date.now(), eventSink = () => {} } = {}) {
    this.kind = clean(kind, 64);
    if (!this.kind) throw new TypeError('kind is required');
    if (!governor?.snapshot) throw new TypeError('governor with snapshot() is required');
    this.governor = governor;
    this.policyKey = clean(policyKey, 128);
    if (!this.policyKey) throw new TypeError('policyKey is required');
    this.maxGlobal = Number.isFinite(Number(maxGlobal)) ? Math.max(0, Math.floor(Number(maxGlobal))) : Infinity;
    this.maxPerKey = Math.max(1, Math.floor(Number(maxPerKey) || 1));
    this.idleTtlMs = Math.max(0, Number(idleTtlMs) || 0);
    this.maxJournal = Math.max(1, Math.min(10_000, Math.floor(Number(maxJournal) || 500)));
    this.clock = clock;
    this.eventSink = typeof eventSink === 'function' ? eventSink : () => {};
    this.records = new Map();
    this.activeLeases = new Map();
    this.waiters = [];
    this.journal = [];
    this.closed = false;
  }

  #policy() {
    const snapshot = this.governor.snapshot();
    const configured = Number(snapshot?.policy?.[this.policyKey]);
    const limit = Math.min(this.maxGlobal, Number.isFinite(configured) ? Math.max(0, Math.floor(configured)) : this.maxGlobal);
    return { state: clean(snapshot?.state ?? 'unknown', 64), limit: Number.isFinite(limit) ? limit : Number.MAX_SAFE_INTEGER };
  }

  #record(key) {
    let record = this.records.get(key);
    if (!record) {
      record = { key, active: 0, lastTouchedAt: this.clock() };
      this.records.set(key, record);
    }
    return record;
  }

  #emit(type, detail = {}) {
    const base = { schema: 'forge.runtime-lease-event.v1', type, kind: this.kind, atMs: this.clock(), ...detail };
    const event = frozen({ ...base, receiptSha256: sha256(base) });
    this.journal.push(event);
    if (this.journal.length > this.maxJournal) this.journal.splice(0, this.journal.length - this.maxJournal);
    try { void this.eventSink(event); } catch {}
    return event;
  }

  #canGrant(waiter, policy = this.#policy()) {
    if (policy.limit <= 0 || this.activeLeases.size >= policy.limit) return false;
    return this.#record(waiter.key).active < this.maxPerKey;
  }

  #grant(waiter) {
    const record = this.#record(waiter.key);
    const acquiredAtMs = this.clock();
    record.active += 1;
    record.lastTouchedAt = acquiredAtMs;
    const id = randomUUID();
    let released = false;
    const leaseRecord = {
      id,
      key: waiter.key,
      missionId: waiter.missionId,
      taskId: waiter.taskId,
      metadata: waiter.metadata,
      enqueuedAtMs: waiter.enqueuedAtMs,
      acquiredAtMs,
    };
    this.activeLeases.set(id, leaseRecord);
    const event = this.#emit('runtime-lease.acquired', {
      leaseId: id,
      key: waiter.key,
      missionId: waiter.missionId,
      taskId: waiter.taskId,
      queueDelayMs: Math.max(0, acquiredAtMs - waiter.enqueuedAtMs),
      active: this.activeLeases.size,
      queued: this.waiters.length,
      governorState: this.#policy().state,
    });
    const lease = frozen({
      schema: 'forge.runtime-lease.v1', id, kind: this.kind, key: waiter.key, missionId: waiter.missionId, taskId: waiter.taskId,
      acquiredAtMs, queueDelayMs: Math.max(0, acquiredAtMs - waiter.enqueuedAtMs), receiptSha256: event.receiptSha256,
      release: () => {
        if (released) return false;
        released = true;
        this.activeLeases.delete(id);
        record.active = Math.max(0, record.active - 1);
        record.lastTouchedAt = this.clock();
        this.#emit('runtime-lease.released', { leaseId: id, key: waiter.key, missionId: waiter.missionId, taskId: waiter.taskId, active: this.activeLeases.size, queued: this.waiters.length });
        this.#drain();
        return true;
      },
    });
    waiter.resolve(lease);
  }

  #drain() {
    if (this.closed) return;
    const policy = this.#policy();
    if (policy.limit <= 0) return;
    while (this.activeLeases.size < policy.limit) {
      const index = this.waiters.findIndex((waiter) => this.#canGrant(waiter, policy));
      if (index < 0) break;
      const [waiter] = this.waiters.splice(index, 1);
      waiter.signal?.removeEventListener?.('abort', waiter.onAbort);
      this.#grant(waiter);
    }
  }

  async acquire({ key, missionId = null, taskId = null, signal = null, metadata = {} } = {}) {
    if (this.closed) throw fail('RUNTIME_LEASE_POOL_CLOSED', `${this.kind} lease pool is closed`);
    const normalizedKey = clean(key, 512);
    if (!normalizedKey) throw new TypeError('lease key is required');
    if (signal?.aborted) throw signal.reason ?? fail('RUNTIME_LEASE_ABORTED', `${this.kind} lease request aborted`);
    const policy = this.#policy();
    if (policy.limit <= 0) throw fail('RUNTIME_LEASE_ADMISSION_BLOCKED', `${this.kind} admission blocked in ${policy.state} state`);
    const request = {
      key: normalizedKey,
      missionId: clean(missionId, 256) || null,
      taskId: clean(taskId, 256) || null,
      metadata: frozen(structuredClone(metadata ?? {})),
      enqueuedAtMs: this.clock(),
      signal,
      resolve: null,
      reject: null,
      onAbort: null,
    };
    return await new Promise((resolve, reject) => {
      request.resolve = resolve;
      request.reject = reject;
      request.onAbort = () => {
        const index = this.waiters.indexOf(request);
        if (index >= 0) this.waiters.splice(index, 1);
        this.#emit('runtime-lease.cancelled', { key: request.key, missionId: request.missionId, taskId: request.taskId, reason: clean(signal?.reason?.message ?? signal?.reason ?? 'aborted', 1000) });
        reject(signal?.reason ?? fail('RUNTIME_LEASE_ABORTED', `${this.kind} lease request aborted`));
      };
      if (this.#canGrant(request, policy) && this.waiters.length === 0) this.#grant(request);
      else {
        this.waiters.push(request);
        signal?.addEventListener?.('abort', request.onAbort, { once: true });
        this.#emit('runtime-lease.queued', { key: request.key, missionId: request.missionId, taskId: request.taskId, active: this.activeLeases.size, queued: this.waiters.length, governorState: policy.state });
        this.#drain();
      }
    });
  }

  async run(input, fn) {
    if (typeof fn !== 'function') throw new TypeError('lease runner must be a function');
    const lease = await this.acquire(input);
    try { return await fn(lease); }
    finally { lease.release(); }
  }

  snapshot() {
    const policy = this.#policy();
    const leases = [...this.activeLeases.values()].map((lease) => ({ id: lease.id, key: lease.key, missionId: lease.missionId, taskId: lease.taskId, acquiredAtMs: lease.acquiredAtMs, queueDelayMs: Math.max(0, lease.acquiredAtMs - lease.enqueuedAtMs) })).sort((a, b) => a.acquiredAtMs - b.acquiredAtMs || a.id.localeCompare(b.id));
    const missionMap = new Map();
    const addMission = (missionId, field) => {
      if (!missionId) return;
      const item = missionMap.get(missionId) ?? { missionId, active: 0, queued: 0 };
      item[field] += 1;
      missionMap.set(missionId, item);
    };
    for (const lease of leases) addMission(lease.missionId, 'active');
    for (const waiter of this.waiters) addMission(waiter.missionId, 'queued');
    const keys = [...this.records.values()].map((record) => ({ key: record.key, active: record.active, queued: this.waiters.filter((waiter) => waiter.key === record.key).length, lastTouchedAt: record.lastTouchedAt })).sort((a, b) => a.key.localeCompare(b.key));
    return frozen({ schema: 'forge.runtime-lease-pool-snapshot.v1', kind: this.kind, state: policy.state, limit: policy.limit, maxPerKey: this.maxPerKey, active: leases.length, queued: this.waiters.length, leases, missions: [...missionMap.values()].sort((a, b) => a.missionId.localeCompare(b.missionId)), keys, journal: [...this.journal], closed: this.closed });
  }

  sweep() {
    const now = this.clock();
    let evictedKeys = 0;
    const queuedKeys = new Set(this.waiters.map((waiter) => waiter.key));
    for (const [key, record] of this.records) {
      if (record.active === 0 && !queuedKeys.has(key) && now - record.lastTouchedAt >= this.idleTtlMs) { this.records.delete(key); evictedKeys += 1; }
    }
    if (evictedKeys) this.#emit('runtime-lease.keys-evicted', { evictedKeys });
    return frozen({ schema: 'forge.runtime-lease-sweep.v1', evictedKeys, remainingKeys: this.records.size });
  }

  close() {
    if (this.closed) return this.snapshot();
    this.closed = true;
    const error = fail('RUNTIME_LEASE_POOL_CLOSED', `${this.kind} lease pool is closed`);
    for (const waiter of this.waiters.splice(0)) {
      waiter.signal?.removeEventListener?.('abort', waiter.onAbort);
      waiter.reject(error);
    }
    this.#emit('runtime-lease.pool-closed', { active: this.activeLeases.size });
    return this.snapshot();
  }
}
