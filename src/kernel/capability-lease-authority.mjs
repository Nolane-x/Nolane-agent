import { createId, deepFreeze, nowIso, required, signed, uniqueStrings, verifySigned } from './kernel-utils.mjs';

const SCOPES = new Set(['once', 'thread', 'project']);
const STATES = new Set(['pending', 'granted', 'denied', 'revoked', 'expired', 'consumed']);
const RISK = new Set(['low', 'medium', 'high', 'critical']);

function normalizeConstraints(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return Object.freeze({});
  const normalized = {
    allowedPaths: uniqueStrings(value.allowedPaths, { maxItems: 256, maxLength: 2_000 }), deniedPaths: uniqueStrings(value.deniedPaths, { maxItems: 256, maxLength: 2_000 }),
    allowedHosts: uniqueStrings(value.allowedHosts, { maxItems: 256, maxLength: 512 }), deniedHosts: uniqueStrings(value.deniedHosts, { maxItems: 256, maxLength: 512 }),
    commandPrefixes: uniqueStrings(value.commandPrefixes, { maxItems: 128, maxLength: 512 }), maxUses: Math.max(1, Math.min(10_000, Number(value.maxUses) || 1)),
  };
  return deepFreeze(normalized);
}

export class CapabilityLeaseAuthority {
  constructor({ reviewer, eventSink = () => {}, clock = Date.now, maxLeases = 50_000 } = {}) {
    if (!reviewer?.reviewCapability) throw new TypeError('CapabilityLeaseAuthority requires a reviewer boundary');
    this.reviewer = reviewer; this.eventSink = eventSink; this.clock = clock; this.maxLeases = Math.max(100, Number(maxLeases) || 50_000); this.leases = new Map();
  }

  restore(leases = []) {
    let restored = 0;
    for (const lease of Array.isArray(leases) ? leases : []) {
      if (!verifySigned(lease) || lease.schema !== 'nolane.sovereign-capability-lease.v1') continue;
      if (!SCOPES.has(String(lease.scope)) || !STATES.has(String(lease.state)) || !RISK.has(String(lease.risk))) continue;
      this.leases.set(String(lease.id), deepFreeze(JSON.parse(JSON.stringify(lease))));
      restored += 1;
      if (this.leases.size >= this.maxLeases) break;
    }
    return restored;
  }

  async request({ threadId, projectId, actorId, capability, resource = '*', scope = 'once', risk = 'medium', reason, ttlMs = 900_000, constraints = {}, policyReceiptSha256 = null, humanDecision = null } = {}) {
    const normalizedScope = String(scope);
    if (!SCOPES.has(normalizedScope)) throw new TypeError(`unsupported capability scope: ${scope}`);
    const normalizedRisk = String(risk).toLowerCase();
    if (!RISK.has(normalizedRisk)) throw new TypeError(`unsupported capability risk: ${risk}`);
    const now = Number(this.clock());
    const expiresAtMs = now + Math.max(1_000, Math.min(86_400_000, Number(ttlMs) || 900_000));
    const base = {
      schema: 'nolane.sovereign-capability-lease.v1', id: createId('lease'), threadId: required(threadId, 'threadId', 256), projectId: required(projectId, 'projectId', 256),
      actorId: required(actorId, 'actorId', 256), capability: required(capability, 'capability', 256), resource: required(resource, 'resource', 2_000),
      scope: normalizedScope, risk: normalizedRisk, reason: required(reason, 'reason', 4_000), constraints: normalizeConstraints(constraints),
      state: 'pending', uses: 0, createdAt: new Date(now).toISOString(), expiresAt: new Date(expiresAtMs).toISOString(), expiresAtMs, policyReceiptSha256,
      reviewReceiptSha256: null, decisionReason: null,
    };
    const request = signed(base);
    const review = await this.reviewer.reviewCapability({ request, actorId: request.actorId, policy: { requireHuman: humanDecision == null ? false : true } });
    let state = review.decision === 'approved' ? 'granted' : 'pending';
    let decisionReason = review.decision;
    if (humanDecision != null) {
      if (!['approved', 'denied'].includes(String(humanDecision))) throw new TypeError('humanDecision must be approved or denied');
      state = humanDecision === 'approved' ? 'granted' : 'denied'; decisionReason = `human-${humanDecision}`;
    }
    const lease = signed({ ...base, state, reviewReceiptSha256: review.receiptSha256, decisionReason });
    this.leases.set(lease.id, lease);
    if (this.leases.size > this.maxLeases) this.leases.delete(this.leases.keys().next().value);
    await this.eventSink({ type: 'kernel.capability.requested', threadId: lease.threadId, payload: { leaseId: lease.id, state: lease.state, capability: lease.capability, resource: lease.resource, reviewReceiptSha256: review.receiptSha256 } });
    return deepFreeze({ lease, review });
  }

  get(leaseId) {
    const lease = this.leases.get(required(leaseId, 'leaseId', 256));
    if (!lease) throw Object.assign(new Error(`capability lease not found: ${leaseId}`), { code: 'SOVEREIGN_CAPABILITY_LEASE_NOT_FOUND', statusCode: 404 });
    return this.#refresh(lease);
  }

  #refresh(lease) {
    if (['granted', 'pending'].includes(lease.state) && Number(this.clock()) >= lease.expiresAtMs) {
      const expired = signed({ ...lease, state: 'expired', decisionReason: 'ttl-expired', updatedAt: nowIso(this.clock) });
      this.leases.set(expired.id, expired); return expired;
    }
    return lease;
  }

  decide(leaseId, { decision, reviewerId = 'human', reason = null } = {}) {
    const current = this.get(leaseId);
    if (current.state !== 'pending') throw Object.assign(new Error(`lease ${leaseId} is not pending`), { code: 'SOVEREIGN_CAPABILITY_LEASE_NOT_PENDING' });
    const normalized = String(decision);
    if (!['approved', 'denied'].includes(normalized)) throw new TypeError('decision must be approved or denied');
    const next = signed({ ...current, state: normalized === 'approved' ? 'granted' : 'denied', decisionReason: reason ?? `${reviewerId}:${normalized}`, decidedBy: String(reviewerId), decidedAt: nowIso(this.clock) });
    this.leases.set(next.id, next); return next;
  }

  authorize({ leaseId, threadId, projectId, actorId, capability, resource = '*', consume = true } = {}) {
    const current = this.get(leaseId);
    const checks = [
      ['state', current.state === 'granted'], ['threadId', current.threadId === String(threadId)], ['projectId', current.projectId === String(projectId)],
      ['actorId', current.actorId === String(actorId)], ['capability', current.capability === String(capability)], ['resource', current.resource === '*' || current.resource === String(resource)],
    ];
    const failed = checks.filter(([, value]) => !value).map(([name]) => name);
    if (failed.length) return signed({ schema: 'nolane.sovereign-capability-authorization.v1', allowed: false, leaseId: current.id, failed, at: nowIso(this.clock) });
    const nextUses = current.uses + (consume ? 1 : 0);
    const exhausted = consume && (current.scope === 'once' || nextUses >= current.constraints.maxUses);
    const next = consume ? signed({ ...current, uses: nextUses, state: exhausted ? 'consumed' : current.state, lastUsedAt: nowIso(this.clock) }) : current;
    if (consume) this.leases.set(next.id, next);
    return signed({ schema: 'nolane.sovereign-capability-authorization.v1', allowed: true, leaseId: next.id, capability: next.capability, resource: String(resource), scope: next.scope, uses: next.uses, exhausted, at: nowIso(this.clock) });
  }

  revoke(leaseId, { actorId = 'kernel', reason = 'revoked' } = {}) {
    const current = this.get(leaseId);
    if (!STATES.has(current.state)) throw new Error('lease state is invalid');
    if (['revoked', 'denied', 'expired', 'consumed'].includes(current.state)) return current;
    const next = signed({ ...current, state: 'revoked', revokedBy: String(actorId), decisionReason: String(reason), revokedAt: nowIso(this.clock) });
    this.leases.set(next.id, next); return next;
  }

  list({ threadId = null, projectId = null, state = null } = {}) {
    const rows = [];
    for (const item of this.leases.values()) {
      const lease = this.#refresh(item);
      if (threadId != null && lease.threadId !== String(threadId)) continue;
      if (projectId != null && lease.projectId !== String(projectId)) continue;
      if (state != null && lease.state !== String(state)) continue;
      rows.push(lease);
    }
    return deepFreeze(rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }

  snapshot({ threadId = null, projectId = null } = {}) {
    const leases = this.list({ threadId, projectId });
    const byState = Object.fromEntries([...STATES].map((state) => [state, leases.filter((item) => item.state === state).length]));
    return signed({ schema: 'nolane.sovereign-capability-ledger.v1', leases, byState: deepFreeze(byState), generatedAt: nowIso(this.clock) });
  }
}
