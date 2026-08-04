import { boundedNumber, optionalText, signed, strings, text } from '../construction/construction-utils.mjs';
const SHA = /^[a-f0-9]{64}$/i;
function sha(value, label) { const out = text(value, label, 64).toLowerCase(); if (!SHA.test(out)) throw new TypeError(`${label.replace(/([A-Z])/g, ' $1').toLowerCase()} SHA-256 is invalid`); return out; }
function participants(value = []) {
  if (!Array.isArray(value) || !value.length) throw new TypeError('participants are required');
  const seen = new Set();
  return Object.freeze(value.map((item, index) => {
    const agentId = text(item.agentId, `participants[${index}].agentId`, 256);
    if (seen.has(agentId)) throw new TypeError('participants contain duplicate agent');
    seen.add(agentId);
    return Object.freeze({ agentId, role: text(item.role, `participants[${index}].role`, 128) });
  }));
}

export class JointCommitmentLedger {
  constructor({ clock = () => Date.now() } = {}) { this.clock = clock; this.items = new Map(); this.waits = new Map(); }
  #get(id) { const item = this.items.get(id); if (!item) throw new Error(`commitment not found: ${id}`); return item; }
  #public(item) { return signed({ schema: 'forge.joint-commitment.v1', commitmentId: item.commitmentId, goal: item.goal, interfaceId: item.interfaceId, revision: item.revision, participants: item.participants, handoffCriteria: item.handoffCriteria, state: item.state, pendingAcknowledgements: [...item.pendingAcknowledgements].sort(), revokedAgents: [...item.revokedAgents].sort(), updatedAtMs: item.updatedAtMs, lastHandoff: item.lastHandoff }); }
  create(input = {}) {
    const commitmentId = text(input.commitmentId, 'commitmentId', 256);
    if (this.items.has(commitmentId)) throw new Error(`commitment already exists: ${commitmentId}`);
    const item = { commitmentId, goal: text(input.goal, 'goal', 8_000), interfaceId: text(input.interfaceId, 'interfaceId', 512), revision: Math.floor(boundedNumber(input.revision, 1, 1, 1_000_000, 'revision')), participants: participants(input.participants), handoffCriteria: strings(input.handoffCriteria, 'handoffCriteria', 100, 1_000), state: 'active', pendingAcknowledgements: new Set(), revokedAgents: new Set(), updatedAtMs: Number(this.clock()), lastHandoff: null };
    this.items.set(commitmentId, item); return this.#public(item);
  }
  renegotiate(input = {}) {
    const item = this.#get(text(input.commitmentId, 'commitmentId', 256));
    const actor = text(input.actorAgentId, 'actorAgentId', 256);
    if (!item.participants.some((p) => p.agentId === actor && p.role === 'owner')) throw new Error('only commitment owner may renegotiate');
    const nextRevision = Math.floor(boundedNumber(input.nextRevision, item.revision + 1, item.revision + 1, 1_000_000, 'nextRevision'));
    sha(input.receiptSha256, 'receiptSha256'); text(input.reason, 'reason', 2_000);
    const affected = strings(input.affectedAgents, 'affectedAgents', 100, 256);
    for (const agentId of affected) if (!item.participants.some((p) => p.agentId === agentId)) throw new Error(`affected agent is not a participant: ${agentId}`);
    item.revision = nextRevision; item.pendingAcknowledgements = new Set(affected); item.state = affected.length ? 'renegotiating' : 'active'; item.updatedAtMs = Number(this.clock());
    return this.#public(item);
  }
  acknowledge(input = {}) {
    const item = this.#get(text(input.commitmentId, 'commitmentId', 256));
    const agentId = text(input.agentId, 'agentId', 256);
    if (Number(input.revision) !== item.revision) throw new Error('commitment revision mismatch');
    sha(input.receiptSha256, 'receiptSha256'); item.pendingAcknowledgements.delete(agentId); if (!item.pendingAcknowledgements.size) item.state = 'active'; item.updatedAtMs = Number(this.clock()); return this.#public(item);
  }
  canProceed(agentId) {
    const id = text(agentId, 'agentId', 256); const blocked = [...this.items.values()].filter((item) => item.pendingAcknowledgements.has(id) || item.revokedAgents.has(id));
    return signed({ schema: 'forge.commitment-proceed-decision.v1', agentId: id, allowed: blocked.length === 0, blockedCommitmentIds: blocked.map((item) => item.commitmentId).sort() });
  }
  handoff(input = {}) {
    const item = this.#get(text(input.commitmentId, 'commitmentId', 256));
    const fromAgentId = text(input.fromAgentId, 'fromAgentId', 256); const toAgentId = text(input.toAgentId, 'toAgentId', 256);
    if (!item.participants.some((p) => p.agentId === fromAgentId) || !item.participants.some((p) => p.agentId === toAgentId)) throw new Error('handoff agents must be participants');
    const artifactSha256 = sha(input.artifactSha256, 'artifactSha256'); const verificationReceiptSha256 = sha(input.verificationReceiptSha256, 'verificationReceiptSha256');
    item.lastHandoff = signed({ schema: 'forge.structured-handoff.v1', commitmentId: item.commitmentId, fromAgentId, toAgentId, artifactSha256, verificationReceiptSha256, revision: item.revision, atMs: Number(this.clock()) });
    item.state = 'handed-off'; item.updatedAtMs = Number(this.clock()); return this.#public(item);
  }
  waitFor(input = {}) {
    const waitingAgentId = text(input.waitingAgentId, 'waitingAgentId', 256); const blockingAgentId = text(input.blockingAgentId, 'blockingAgentId', 256); const commitmentId = text(input.commitmentId, 'commitmentId', 256); this.#get(commitmentId);
    this.waits.set(`${waitingAgentId}->${blockingAgentId}:${commitmentId}`, { waitingAgentId, blockingAgentId, commitmentId, sinceMs: Number(this.clock()) }); return this.detectDeadlocks();
  }
  detectDeadlocks({ stalledAfterMs = 120_000 } = {}) {
    const graph = new Map(); for (const edge of this.waits.values()) { if (!graph.has(edge.waitingAgentId)) graph.set(edge.waitingAgentId, new Set()); graph.get(edge.waitingAgentId).add(edge.blockingAgentId); }
    const cycles = []; const visiting = []; const visited = new Set();
    const walk = (node) => { const index = visiting.indexOf(node); if (index >= 0) { const cycle = [...visiting.slice(index), node]; const key = [...new Set(cycle)].sort().join('|'); if (!cycles.some((x) => x.key === key)) cycles.push({ key, agents: cycle }); return; } if (visited.has(node)) return; visiting.push(node); for (const next of graph.get(node) ?? []) walk(next); visiting.pop(); visited.add(node); };
    for (const node of graph.keys()) walk(node);
    const now = Number(this.clock()); const stalled = [...this.waits.values()].filter((edge) => now - edge.sinceMs >= Number(stalledAfterMs));
    return signed({ schema: 'forge.commitment-deadlock-report.v1', cycles: cycles.map(({ agents }) => agents), stalled, claims: { automaticMergeExecuted: false } });
  }
  revoke(input = {}) {
    const item = this.#get(text(input.commitmentId, 'commitmentId', 256)); const agentId = text(input.agentId, 'agentId', 256); text(input.reason, 'reason', 2_000); sha(input.receiptSha256, 'receiptSha256'); item.revokedAgents.add(agentId); item.state = 'revoked'; for (const [key, edge] of this.waits) if (edge.waitingAgentId === agentId || edge.blockingAgentId === agentId) this.waits.delete(key); return this.#public(item);
  }
  reassign(input = {}) {
    const item = this.#get(text(input.commitmentId, 'commitmentId', 256)); const fromAgentId = text(input.fromAgentId, 'fromAgentId', 256); const toAgentId = text(input.toAgentId, 'toAgentId', 256); sha(input.receiptSha256, 'receiptSha256'); const old = item.participants.find((p) => p.agentId === fromAgentId); if (!old) throw new Error('source agent is not a participant'); item.participants = Object.freeze([...item.participants.filter((p) => p.agentId !== fromAgentId), Object.freeze({ agentId: toAgentId, role: old.role })]); item.revokedAgents.delete(fromAgentId); item.state = 'active'; item.updatedAtMs = Number(this.clock()); return this.#public(item);
  }
  snapshot() { return signed({ schema: 'forge.joint-commitment-ledger-snapshot.v1', commitments: [...this.items.values()].map((item) => this.#public(item)), waits: [...this.waits.values()], claims: { publicContractChangedWithoutRenegotiation: false, hiddenReasoningStored: false } }); }
}
