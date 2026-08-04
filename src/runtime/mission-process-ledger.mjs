import { createHash, randomUUID } from 'node:crypto';

function clean(value, max = 256) { return String(value ?? '').trim().slice(0, max); }
function positivePid(value) { const pid = Number(value); if (!Number.isInteger(pid) || pid <= 0) throw new TypeError('rootPid must be a positive integer'); return pid; }
function stable(value) { if (Array.isArray(value)) return value.map(stable); if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])); return value; }
function sha256(value) { return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex'); }
function deepFreeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; for (const item of Object.values(value)) deepFreeze(item); return Object.freeze(value); }
function metadataView(metadata = {}) {
  const allowed = ['executable', 'kind', 'role', 'profileId', 'runtimeKind', 'workspaceHash'];
  const output = {};
  for (const key of allowed) { const value = clean(metadata?.[key], 256); if (value) output[key] = value; }
  return deepFreeze(output);
}
function emptyUsage() { return { cpuTimeMs: 0, rssBytes: 0, processCount: 0, fileDescriptors: null, pids: [] }; }

export class MissionProcessLedger {
  constructor({ driver, clock = () => Date.now(), maxEntries = 2_000, maxJournal = 2_000, eventSink = () => {} } = {}) {
    if (!driver?.sampleTree) throw new TypeError('driver with sampleTree() is required');
    this.driver = driver;
    this.clock = clock;
    this.maxEntries = Math.max(1, Math.floor(Number(maxEntries) || 2_000));
    this.maxJournal = Math.max(1, Math.floor(Number(maxJournal) || 2_000));
    this.eventSink = typeof eventSink === 'function' ? eventSink : () => {};
    this.entries = new Map();
    this.journal = [];
    this.closed = false;
  }

  #event(type, detail = {}) {
    const base = { schema: 'forge.mission-process-ledger-event.v1', type, atMs: this.clock(), ...detail };
    const event = deepFreeze({ ...base, receiptSha256: sha256(base) });
    this.journal.push(event);
    if (this.journal.length > this.maxJournal) this.journal.splice(0, this.journal.length - this.maxJournal);
    try { void this.eventSink(event); } catch {}
    return event;
  }

  #view(record) {
    const base = {
      schema: 'forge.mission-process-entry.v1', id: record.id, rootPid: record.rootPid,
      projectId: record.projectId, missionId: record.missionId, taskId: record.taskId,
      providerId: record.providerId, sessionId: record.sessionId, state: record.state,
      registeredAtMs: record.registeredAtMs, sampledAtMs: record.sampledAtMs,
      finalizedAtMs: record.finalizedAtMs, exitReason: record.exitReason,
      metadata: record.metadata,
      capabilities: { fileDescriptors: typeof this.driver.sampleFileDescriptors === 'function' ? 'available' : 'unavailable' },
      current: { ...record.current, pids: [...record.current.pids] },
      peak: { ...record.peak }, cpuDeltaMs: record.cpuDeltaMs, rssMbSeconds: record.rssMbSeconds,
      sampleCount: record.sampleCount,
    };
    return deepFreeze({ ...base, receiptSha256: sha256(base) });
  }

  register({ rootPid, projectId = null, missionId = null, taskId = null, providerId = null, sessionId = null, metadata = {} } = {}) {
    if (this.closed) throw Object.assign(new Error('Mission process ledger is closed'), { code: 'MISSION_PROCESS_LEDGER_CLOSED' });
    const record = {
      id: randomUUID(), rootPid: positivePid(rootPid),
      projectId: clean(projectId) || null, missionId: clean(missionId) || null, taskId: clean(taskId) || null,
      providerId: clean(providerId) || null, sessionId: clean(sessionId) || null,
      metadata: metadataView(metadata), state: 'registered', registeredAtMs: this.clock(), sampledAtMs: null,
      finalizedAtMs: null, exitReason: null, current: emptyUsage(), peak: { rssBytes: 0, processCount: 0, fileDescriptors: null },
      cpuDeltaMs: 0, rssMbSeconds: 0, sampleCount: 0,
    };
    this.entries.set(record.id, record);
    while (this.entries.size > this.maxEntries) {
      const removable = [...this.entries.values()].find((entry) => entry.state === 'exited');
      if (!removable) break;
      this.entries.delete(removable.id);
    }
    this.#event('mission-process.registered', { entryId: record.id, rootPid: record.rootPid, projectId: record.projectId, missionId: record.missionId, taskId: record.taskId, providerId: record.providerId, sessionId: record.sessionId });
    return this.#view(record);
  }

  async sample(id) {
    const record = this.entries.get(clean(id, 128));
    if (!record) throw Object.assign(new Error(`Unknown process ledger entry: ${id}`), { code: 'MISSION_PROCESS_UNKNOWN' });
    if (record.state === 'exited') return this.#view(record);
    try {
      const previousCpu = Number(record.current.cpuTimeMs) || 0;
      const sample = await this.driver.sampleTree(record.rootPid);
      let fileDescriptors = null;
      if (typeof this.driver.sampleFileDescriptors === 'function') {
        try { fileDescriptors = Math.max(0, Number(await this.driver.sampleFileDescriptors(record.rootPid)) || 0); }
        catch (error) { if (!['SANDBOX_PROCESS_NOT_FOUND', 'ENOENT', 'ESRCH', 'EACCES'].includes(error?.code)) throw error; }
      }
      const sampledAtMs = this.clock();
      const previousSampledAtMs = record.sampledAtMs;
      const previousRssBytes = Number(record.current.rssBytes) || 0;
      record.current = {
        cpuTimeMs: Math.max(0, Number(sample.cpuTimeMs) || 0), rssBytes: Math.max(0, Number(sample.rssBytes) || 0),
        processCount: Math.max(0, Math.floor(Number(sample.processCount) || 0)), fileDescriptors,
        pids: Array.isArray(sample.pids) ? sample.pids.map(Number).filter((pid) => Number.isInteger(pid) && pid > 0) : [],
      };
      record.cpuDeltaMs = record.sampleCount ? Math.max(0, record.current.cpuTimeMs - previousCpu) : record.current.cpuTimeMs;
      record.peak.rssBytes = Math.max(record.peak.rssBytes, record.current.rssBytes);
      record.peak.processCount = Math.max(record.peak.processCount, record.current.processCount);
      record.peak.fileDescriptors = fileDescriptors == null ? record.peak.fileDescriptors : Math.max(record.peak.fileDescriptors ?? 0, fileDescriptors);
      if (previousSampledAtMs != null && sampledAtMs >= previousSampledAtMs) record.rssMbSeconds += (((previousRssBytes + record.current.rssBytes) / 2) / (1024 * 1024)) * ((sampledAtMs - previousSampledAtMs) / 1000);
      record.sampledAtMs = sampledAtMs; record.sampleCount += 1; record.state = 'running';
      this.#event('mission-process.sampled', { entryId: record.id, missionId: record.missionId, taskId: record.taskId, providerId: record.providerId, rssBytes: record.current.rssBytes, cpuTimeMs: record.current.cpuTimeMs, processCount: record.current.processCount, fileDescriptors });
      return this.#view(record);
    } catch (error) {
      if (['SANDBOX_PROCESS_NOT_FOUND', 'ESRCH', 'ENOENT'].includes(error?.code)) return this.finalize(record.id, 'process-unavailable');
      throw error;
    }
  }

  finalize(id, reason = 'completed') {
    const record = this.entries.get(clean(id, 128));
    if (!record) throw Object.assign(new Error(`Unknown process ledger entry: ${id}`), { code: 'MISSION_PROCESS_UNKNOWN' });
    if (record.state !== 'exited') {
      record.state = 'exited'; record.exitReason = clean(reason, 160) || 'completed'; record.finalizedAtMs = this.clock();
      this.#event('mission-process.finalized', { entryId: record.id, missionId: record.missionId, taskId: record.taskId, providerId: record.providerId, reason: record.exitReason, peakRssBytes: record.peak.rssBytes });
    }
    return this.#view(record);
  }

  snapshot({ projectId = null, missionId = null, taskId = null, providerId = null, state = null } = {}) {
    const entries = [...this.entries.values()].filter((entry) =>
      (!projectId || entry.projectId === String(projectId)) && (!missionId || entry.missionId === String(missionId)) &&
      (!taskId || entry.taskId === String(taskId)) && (!providerId || entry.providerId === String(providerId)) && (!state || entry.state === String(state)))
      .map((entry) => this.#view(entry));
    const aggregates = {
      currentRssBytes: entries.reduce((sum, entry) => sum + entry.current.rssBytes, 0),
      peakRssBytes: entries.reduce((sum, entry) => sum + entry.peak.rssBytes, 0),
      currentProcessCount: entries.reduce((sum, entry) => sum + entry.current.processCount, 0),
      currentFileDescriptors: entries.some((entry) => entry.current.fileDescriptors != null) ? entries.reduce((sum, entry) => sum + (entry.current.fileDescriptors ?? 0), 0) : null,
      cpuTimeMs: entries.reduce((sum, entry) => sum + entry.current.cpuTimeMs, 0),
      rssMbSeconds: entries.reduce((sum, entry) => sum + entry.rssMbSeconds, 0),
      activeEntries: entries.filter((entry) => entry.state !== 'exited').length,
    };
    const base = { schema: 'forge.mission-process-ledger-snapshot.v1', entries, aggregates, journal: [...this.journal], closed: this.closed };
    return deepFreeze({ ...base, receiptSha256: sha256(base) });
  }

  close() {
    if (this.closed) return this.snapshot();
    for (const record of this.entries.values()) if (record.state !== 'exited') this.finalize(record.id, 'ledger-closed');
    this.closed = true;
    this.#event('mission-process.ledger-closed', { entries: this.entries.size });
    return this.snapshot();
  }
}
