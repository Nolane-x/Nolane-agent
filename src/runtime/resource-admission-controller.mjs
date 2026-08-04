import { randomUUID } from 'node:crypto';
import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { ViabilityRegionController } from './viability-region-controller.mjs';

const KINDS = new Set(['model', 'browser', 'terminal', 'lsp', 'embedding', 'indexer', 'test', 'provider']);
function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; for (const child of Object.values(value)) freeze(child); return Object.freeze(value); }
function text(value, label, max = 256) { const out = String(value ?? '').trim(); if (!out) throw new TypeError(`${label} is required`); if (out.length > max) throw new TypeError(`${label} is too long`); return out; }
function nonnegative(value) { const n = Number(value ?? 0); return Number.isFinite(n) && n >= 0 ? n : 0; }
function signed(base) { return freeze({ ...base, receiptSha256: canonicalSha256(base) }); }
export class ResourceAdmissionController {
  constructor({ viability = new ViabilityRegionController(), clock = () => Date.now(), minUtilityPerMbSecond = 0.000005, maxLeases = 2_000 } = {}) {
    if (!viability?.evaluate) throw new TypeError('viability controller is required');
    this.viability = viability; this.clock = clock; this.minUtilityPerMbSecond = Math.max(0, Number(minUtilityPerMbSecond) || 0.000005); this.maxLeases = Math.max(1, Number(maxLeases) || 2_000); this.leases = new Map(); this.closed = [];
  }
  admit(input = {}, currentMetrics = {}) {
    const kind = String(input.kind ?? '').toLowerCase(); if (!KINDS.has(kind)) throw new TypeError(`unknown resource kind: ${kind}`);
    const resourceId = text(input.resourceId, 'resourceId'); const expectedVerifiedUtility = Math.max(0, Math.min(1, Number(input.expectedVerifiedUtility) || 0));
    const rssBudgetMb = nonnegative(input.rssBudgetMb); const timeCostSeconds = Math.max(1, nonnegative(input.timeCostSeconds));
    const plannedExtra = nonnegative(input.plannedDemand?.testRssMb) + nonnegative(input.plannedDemand?.browserRssMb) + nonnegative(input.plannedDemand?.embeddingRssMb);
    let viability = this.viability.evaluate(currentMetrics, { rssMb: rssBudgetMb + plannedExtra, irreversibleActions: input.reversible === false ? 1 : 0 });
    const evictLeaseIds = [];
    if (!viability.inside) {
      const candidates = [...this.leases.values()].filter((lease) => lease.kind === 'embedding' && lease.state === 'active').sort((a,b) => a.expectedVerifiedUtility-b.expectedVerifiedUtility || a.createdAtMs-b.createdAtMs);
      let recoveredRam = 0;
      for (const lease of candidates) { evictLeaseIds.push(lease.resourceId); recoveredRam += lease.rssBudgetMb; viability = this.viability.evaluate({ ...currentMetrics, availableRamMb: nonnegative(currentMetrics.availableRamMb) + recoveredRam }, { rssMb: rssBudgetMb + plannedExtra, irreversibleActions: input.reversible === false ? 1 : 0 }); if (viability.inside) break; }
    }
    const utilityPerMbSecond = expectedVerifiedUtility / Math.max(1, rssBudgetMb * timeCostSeconds);
    const reasons = [];
    if (kind === 'browser' && input.taskProfile?.backendOnly === true && expectedVerifiedUtility < 0.2) reasons.push('backend-only task has insufficient browser utility');
    if (utilityPerMbSecond < this.minUtilityPerMbSecond) reasons.push(`utility per MB-second ${utilityPerMbSecond} below threshold`);
    if (!viability.inside) reasons.push(...viability.breaches);
    if (input.reversible === false && !viability.allowIrreversible) reasons.push('irreversible action would leave the viability region');
    if (this.leases.size >= this.maxLeases) reasons.push('resource lease capacity reached');
    const allowed = reasons.length === 0;
    let lease = null;
    if (allowed) {
      const createdAtMs = Math.trunc(Number(this.clock()));
      lease = {
        schema: 'forge.resource-lease.v1', leaseId: `lease_${randomUUID().replaceAll('-', '')}`, resourceId, kind,
        missionId: text(input.missionId, 'missionId'), taskId: text(input.taskId, 'taskId'), owner: text(input.owner, 'owner'),
        processRoot: input.processRoot == null ? null : Math.trunc(Number(input.processRoot)), rssBudgetMb, cpuBudgetSeconds: nonnegative(input.cpuBudgetSeconds),
        fdBudget: Math.floor(nonnegative(input.fdBudget)), processBudget: Math.floor(nonnegative(input.processBudget)), expectedVerifiedUtility, timeCostSeconds,
        idleTtlMs: Math.max(0, Math.floor(nonnegative(input.idleTtlMs))), reversible: input.reversible !== false, utilityPerMbSecond,
        createdAtMs, lastSampleAtMs: null, lastRssMb: null, rssMbSeconds: 0, state: 'active',
      };
      lease = signed(lease); this.leases.set(lease.leaseId, { ...lease });
    }
    return signed({ schema: 'forge.resource-admission-decision.v1', allowed, reasons: freeze(reasons), evictLeaseIds: freeze(evictLeaseIds), viability, utilityPerMbSecond, lease: lease ? freeze(lease) : null, claims: { resourceLaunched: false, processKilled: false } });
  }
  sample(leaseId, { rssMb, atMs = this.clock() } = {}) {
    const lease = this.leases.get(String(leaseId)); if (!lease) throw new Error(`Unknown resource lease: ${leaseId}`);
    const time = Math.trunc(Number(atMs)); const currentRss = nonnegative(rssMb);
    if (lease.lastSampleAtMs != null) lease.rssMbSeconds += lease.lastRssMb * Math.max(0, time - lease.lastSampleAtMs) / 1_000;
    lease.lastSampleAtMs = time; lease.lastRssMb = currentRss;
    return freeze({ leaseId: lease.leaseId, rssMb: currentRss, rssMbSeconds: lease.rssMbSeconds, atMs: time });
  }
  getLease(leaseId) { const lease = this.leases.get(String(leaseId)); return lease ? freeze({ ...lease }) : null; }
  release(leaseId, { rssMb = null, atMs = this.clock(), reason = 'released' } = {}) {
    const lease = this.leases.get(String(leaseId)); if (!lease) throw new Error(`Unknown resource lease: ${leaseId}`);
    const time = Math.trunc(Number(atMs));
    if (lease.lastSampleAtMs != null) lease.rssMbSeconds += lease.lastRssMb * Math.max(0, time - lease.lastSampleAtMs) / 1_000;
    else if (rssMb != null) lease.rssMbSeconds += nonnegative(rssMb) * Math.max(0, time - lease.createdAtMs) / 1_000;
    lease.state = 'closed'; lease.closedAtMs = time; lease.closeReason = String(reason); this.leases.delete(lease.leaseId); this.closed.push(lease);
    return signed({ schema: 'forge.resource-lease-close.v1', leaseId: lease.leaseId, resourceId: lease.resourceId, kind: lease.kind, rssMbSeconds: lease.rssMbSeconds, reason: lease.closeReason, closedAtMs: time });
  }
  snapshot() { return signed({ schema: 'forge.resource-admission-snapshot.v1', active: freeze([...this.leases.values()].map((x) => ({ leaseId: x.leaseId, resourceId: x.resourceId, kind: x.kind, missionId: x.missionId, taskId: x.taskId, owner: x.owner, processRoot: x.processRoot, rssBudgetMb: x.rssBudgetMb, rssMbSeconds: x.rssMbSeconds, idleTtlMs: x.idleTtlMs, createdAtMs: x.createdAtMs, lastSampleAtMs: x.lastSampleAtMs, state: x.state }))), closedCount: this.closed.length, claims: { resourceLaunched: false } }); }
}
