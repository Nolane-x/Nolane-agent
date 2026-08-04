import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const DEFAULTS = Object.freeze({
  minAvailableRamMb: 800,
  minDiskFreeMb: 2_000,
  maxErrorRate: 0.2,
  maxActiveAgents: 4,
  maxPendingIrreversibleActions: 1,
  maxUnverifiedMemory: 100,
  maxPolicyDrift: 0.7,
});
function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; for (const child of Object.values(value)) freeze(child); return Object.freeze(value); }
function finite(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function signed(base) { return freeze({ ...base, receiptSha256: canonicalSha256(base) }); }

export class ViabilityRegionController {
  constructor({ limits = {} } = {}) { this.limits = Object.freeze({ ...DEFAULTS, ...limits }); }
  evaluate(current = {}, planned = {}) {
    const predicted = freeze({
      availableRamMb: finite(current.availableRamMb) - Math.max(0, finite(planned.rssMb)),
      diskFreeMb: finite(current.diskFreeMb) - Math.max(0, finite(planned.diskMb)),
      errorRate: Math.max(0, finite(current.errorRate)) + Math.max(0, finite(planned.errorRate)),
      activeAgents: Math.max(0, finite(current.activeAgents)) + Math.max(0, finite(planned.activeAgents)),
      pendingIrreversibleActions: Math.max(0, finite(current.pendingIrreversibleActions)) + Math.max(0, finite(planned.irreversibleActions)),
      unverifiedMemory: Math.max(0, finite(current.unverifiedMemory)) + Math.max(0, finite(planned.unverifiedMemory)),
      policyDrift: Math.max(0, finite(current.policyDrift)) + Math.max(0, finite(planned.policyDrift)),
    });
    const l = this.limits; const breaches = [];
    if (predicted.availableRamMb < l.minAvailableRamMb) breaches.push(`available RAM ${predicted.availableRamMb}MB below ${l.minAvailableRamMb}MB`);
    if (predicted.diskFreeMb < l.minDiskFreeMb) breaches.push(`disk free ${predicted.diskFreeMb}MB below ${l.minDiskFreeMb}MB`);
    if (predicted.errorRate > l.maxErrorRate) breaches.push(`error rate ${predicted.errorRate} above ${l.maxErrorRate}`);
    if (predicted.activeAgents > l.maxActiveAgents) breaches.push(`active agents ${predicted.activeAgents} above ${l.maxActiveAgents}`);
    if (predicted.pendingIrreversibleActions > l.maxPendingIrreversibleActions) breaches.push(`irreversible actions ${predicted.pendingIrreversibleActions} above ${l.maxPendingIrreversibleActions}`);
    if (predicted.unverifiedMemory > l.maxUnverifiedMemory) breaches.push(`unverified memory ${predicted.unverifiedMemory} above ${l.maxUnverifiedMemory}`);
    if (predicted.policyDrift > l.maxPolicyDrift) breaches.push(`policy drift ${predicted.policyDrift} above ${l.maxPolicyDrift}`);
    const inside = breaches.length === 0;
    const pressure = predicted.availableRamMb < l.minAvailableRamMb * 1.5 ? 'brownout' : predicted.availableRamMb < l.minAvailableRamMb * 2.5 ? 'pressure' : 'normal';
    return signed({ schema: 'forge.viability-region-decision.v1', inside, allowIrreversible: inside && predicted.pendingIrreversibleActions <= l.maxPendingIrreversibleActions, pressure, predicted, limits: l, breaches: freeze(breaches) });
  }
}
