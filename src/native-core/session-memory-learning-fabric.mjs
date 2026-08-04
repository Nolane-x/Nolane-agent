const freeze = (value) => {
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  if (value && typeof value === 'object') return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, freeze(entry)])));
  return value;
};
const profileScope = (profileId) => `profile:${String(profileId ?? '').trim()}`;
function requireVerified(receipt) {
  if (receipt?.verified !== true || receipt?.modelClaim === true || !receipt.verifierId || !Array.isArray(receipt.evidenceIds) || receipt.evidenceIds.length === 0 || !receipt.receiptSha256) throw new Error('Learning requires an independently verified outcome receipt');
  return receipt;
}

export class SessionMemoryLearningFabric {
  constructor({ sessions, memory, skills, maxActiveMemories = 100 } = {}) {
    if (!sessions?.open || !memory?.init || !skills?.discover) throw new TypeError('SessionMemoryLearningFabric requires sessions, memory and skills');
    if (!Number.isInteger(maxActiveMemories) || maxActiveMemories < 1) throw new TypeError('maxActiveMemories must be a positive integer');
    this.sessions = sessions; this.memory = memory; this.skills = skills; this.maxActiveMemories = maxActiveMemories; this.ready = false;
  }
  async open() { await Promise.all([this.sessions.open(), this.memory.init(), this.skills.discover()]); this.ready = true; return this.snapshot(); }
  #assertReady() { if (!this.ready) throw new Error('SessionMemoryLearningFabric.open() is required'); }
  createSession(input) { this.#assertReady(); return this.sessions.createSession(input); }
  appendMessage(sessionId, message, options) { this.#assertReady(); return this.sessions.appendMessage(sessionId, message, options); }
  getSession(id, options) { this.#assertReady(); return this.sessions.getSession(id, options); }
  searchSessions(query, options) { this.#assertReady(); return this.sessions.search(query, options); }

  async learn({ profileId, key, value, outcomeReceipt, ttlMs = null } = {}) {
    this.#assertReady(); const receipt = requireVerified(outcomeReceipt); const scope = profileScope(profileId);
    const stored = await this.memory.put({ key, value, scope, ttlMs, provenance: [receipt.receiptSha256, ...receipt.evidenceIds] });
    const consolidation = await this.#bound(scope, stored.receiptSha256);
    return freeze({ ...stored, consolidation });
  }
  recall({ profileId, key } = {}) { this.#assertReady(); return this.memory.get({ key, scope: profileScope(profileId) }); }
  searchMemory({ profileId, prefix = '', limit = 100 } = {}) { this.#assertReady(); return this.memory.search({ scope: profileScope(profileId), prefix, limit }); }
  async #bound(scope, evidenceReceipt) {
    const active = [...await this.memory.search({ scope, limit: 1000 })].sort((a, b) => Number(a.createdAt) - Number(b.createdAt) || a.key.localeCompare(b.key));
    const invalidated = [];
    while (active.length > this.maxActiveMemories) {
      const oldest = active.shift();
      invalidated.push(await this.memory.invalidate({ key: oldest.key, scope, reason: 'bounded-memory-consolidation', provenanceReceipt: evidenceReceipt }));
    }
    return freeze({ limit: this.maxActiveMemories, active: active.length, invalidated });
  }

  async gradeSkill({ profileId, skillId, score, outcomeReceipt } = {}) {
    this.#assertReady(); const receipt = requireVerified(outcomeReceipt);
    if (!Number.isFinite(Number(score)) || Number(score) < 0 || Number(score) > 1) throw new TypeError('skill score must be between 0 and 1');
    const scope = profileScope(profileId); const key = `skill-grade:${skillId}`; const current = await this.memory.get({ key, scope });
    const state = current?.value ?? { activeVersion: 0, versions: [] };
    const version = state.versions.length + 1;
    const versionRecord = { version, score: Number(score), evidenceReceipt: receipt.receiptSha256, evidenceIds: [...receipt.evidenceIds], active: true, rolledBack: false };
    const next = { activeVersion: version, versions: state.versions.map((entry) => ({ ...entry, active: false })), lastVerifierId: receipt.verifierId };
    next.versions.push(versionRecord);
    const stored = await this.memory.put({ key, scope, value: next, provenance: [receipt.receiptSha256, ...receipt.evidenceIds], expectedVersion: current?.version ?? 0 });
    await this.skills.certify(skillId, { version, score, receiptSha256: stored.receiptSha256 });
    return freeze({ ...versionRecord, active: true, memoryReceiptSha256: stored.receiptSha256 });
  }

  async rollbackSkill({ profileId, skillId, reason, evidenceReceipt } = {}) {
    this.#assertReady(); const scope = profileScope(profileId); const key = `skill-grade:${skillId}`; const current = await this.memory.get({ key, scope });
    if (!current || current.value.activeVersion <= 1) throw new Error('No previous skill version available for rollback');
    const fromVersion = current.value.activeVersion; const activeVersion = fromVersion - 1;
    const next = { ...current.value, activeVersion, versions: current.value.versions.map((entry) => ({ ...entry, active: entry.version === activeVersion, rolledBack: entry.version === fromVersion ? true : entry.rolledBack, rollbackReason: entry.version === fromVersion ? String(reason) : entry.rollbackReason ?? null })) };
    const stored = await this.memory.put({ key, scope, value: next, provenance: [String(evidenceReceipt)], expectedVersion: current.version });
    const registryReceipt = this.skills.rollback(skillId, { fromVersion, toVersion: activeVersion, reason, evidenceReceipt });
    return freeze({ ...registryReceipt, memoryReceiptSha256: stored.receiptSha256 });
  }
  async skillStatus({ profileId, skillId } = {}) { this.#assertReady(); return (await this.memory.get({ key: `skill-grade:${skillId}`, scope: profileScope(profileId) }))?.value ?? null; }
  snapshot() {
    this.#assertReady(); const sessions = this.sessions.snapshot(); const memory = this.memory.snapshot();
    return freeze({ schema: 'nolane.native-core.state-learning.v1', ready: this.ready, sessions: sessions.sessions, profiles: sessions.profiles, activeMemories: memory.activeRecords ?? memory.records, memoryAuditEvents: memory.auditEvents });
  }
}
