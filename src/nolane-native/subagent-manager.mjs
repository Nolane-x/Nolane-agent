import crypto from 'node:crypto';
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const stable = (value) => { if (Array.isArray(value)) return value.map(stable); if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])); return value; };

export class NolaneSubagentManager {
  constructor({ maxChildrenPerMission = 4, clock = () => Date.now(), defaultLeaseTtlMs = 60_000 } = {}) {
    this.maxChildrenPerMission = maxChildrenPerMission; this.clock = clock; this.defaultLeaseTtlMs = Math.max(1, Number(defaultLeaseTtlMs) || 60_000); this.agents = new Map(); this.fingerprintAttempts = new Map();
  }
  spawn({ missionId, parentAgentId, agentId, objective, parentCapabilities = [], delegatedCapabilities = [], allowedPaths = [], retryFingerprint = agentId, leaseTtlMs = this.defaultLeaseTtlMs }) {
    if (!missionId || !parentAgentId || !agentId || !objective) throw new Error('missionId, parentAgentId, agentId and objective are required');
    if (this.agents.has(agentId)) throw new Error(`agent already exists: ${agentId}`);
    const active = [...this.agents.values()].filter((item) => item.missionId === missionId && ['running', 'waiting'].includes(item.status));
    if (active.length >= this.maxChildrenPerMission) throw new Error(`subagent limit reached for mission ${missionId}`);
    if (active.some((item) => item.retryFingerprint === String(retryFingerprint))) throw new Error(`duplicate active work fingerprint: ${retryFingerprint}`);
    const authority = new Set(parentCapabilities); const unauthorized = delegatedCapabilities.filter((capability) => !authority.has(capability));
    if (unauthorized.length) throw new Error(`delegated authority exceeds parent: ${unauthorized.join(', ')}`);
    const attempt = (this.fingerprintAttempts.get(String(retryFingerprint)) ?? 0) + 1; this.fingerprintAttempts.set(String(retryFingerprint), attempt);
    const startedAt = this.clock();
    const record = Object.freeze({ missionId, parentAgentId, agentId, objective, retryFingerprint: String(retryFingerprint), attempt, leaseTtlMs: Math.max(1, Number(leaseTtlMs) || this.defaultLeaseTtlMs), leaseExpiresAt: startedAt + Math.max(1, Number(leaseTtlMs) || this.defaultLeaseTtlMs), lastHeartbeatAt: startedAt, capabilities: Object.freeze([...new Set(delegatedCapabilities)].sort()), allowedPaths: Object.freeze([...new Set(allowedPaths)].sort()), status: 'running', startedAt, completedAt: null, handoff: null });
    this.agents.set(agentId, record); return record;
  }
  heartbeat(agentId) { const agent = this.#require(agentId); if (agent.status !== 'running') throw new Error(`subagent is not running: ${agentId}`); const now = this.clock(); const next = Object.freeze({ ...agent, lastHeartbeatAt: now, leaseExpiresAt: now + agent.leaseTtlMs }); this.agents.set(agentId, next); return next; }
  recoverStale() { const stale = []; for (const [id, agent] of this.agents) { if (agent.status === 'running' && agent.leaseExpiresAt <= this.clock()) { this.agents.set(id, Object.freeze({ ...agent, status: 'stale', completedAt: this.clock(), cancellationReason: 'lease-expired' })); stale.push(id); } } return Object.freeze(stale.sort()); }
  complete(agentId, { summary, evidence = [], verified = false } = {}) {
    const agent = this.#require(agentId); if (agent.status !== 'running') throw new Error(`subagent is not running: ${agentId}`); if (agent.leaseExpiresAt <= this.clock()) throw new Error(`subagent lease expired: ${agentId}`);
    if (!verified) throw new Error('verified handoff is required'); if (typeof summary !== 'string' || !summary.trim()) throw new Error('handoff summary is required');
    if (!Array.isArray(evidence) || evidence.length === 0 || evidence.some((item) => !/^[a-f0-9]{64}$/.test(item?.receiptSha256 ?? ''))) throw new Error('handoff requires valid evidence receipts');
    const base = stable({ schema: 'nolane.agent.subagent-handoff.v2', agentId, missionId: agent.missionId, parentAgentId: agent.parentAgentId, retryFingerprint: agent.retryFingerprint, attempt: agent.attempt, summary, evidence, verified: true });
    const handoff = Object.freeze({ ...base, handoffSha256: sha256(JSON.stringify(base)) }); this.agents.set(agentId, Object.freeze({ ...agent, status: 'completed', completedAt: this.clock(), handoff })); return handoff;
  }
  cancelMission(missionId, { reason = 'cancelled' } = {}) { const cancelled = []; for (const [id, agent] of this.agents) { if (agent.missionId !== missionId || !['running', 'waiting'].includes(agent.status)) continue; this.agents.set(id, Object.freeze({ ...agent, status: 'cancelled', completedAt: this.clock(), cancellationReason: reason })); cancelled.push(id); } return Object.freeze(cancelled); }
  snapshot() { return Object.freeze({ agents: this.agents.size, running: [...this.agents.values()].filter((entry) => entry.status === 'running').length, stale: [...this.agents.values()].filter((entry) => entry.status === 'stale').length }); }
  get(agentId) { const agent = this.agents.get(agentId); return agent ? structuredClone(agent) : null; }
  #require(id) { const agent = this.agents.get(id); if (!agent) throw new Error(`unknown subagent: ${id}`); return agent; }
}
