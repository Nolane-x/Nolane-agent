import { canonicalSha256, deepFreeze } from './shared.mjs';

const SHA = /^[a-f0-9]{64}$/i;
const bounded = (value, label) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) throw new TypeError(`${label} must be between 0 and 1`);
  return number;
};

function receipt(schema, body) {
  const base = { schema, ...body };
  return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
}

export class LatentMemoryRouter {
  #versions = new Map();
  #active = new Map();
  #leases = new Map();
  #nextLease = 1;
  #rollbacks = 0;
  #minBackwardTransfer;
  #abstainUncertainty;

  constructor({ minBackwardTransfer = -0.05, abstainUncertainty = 0.85 } = {}) {
    this.#minBackwardTransfer = Number(minBackwardTransfer);
    this.#abstainUncertainty = bounded(abstainUncertainty, 'abstainUncertainty');
  }

  registerExpert({ id, version, domains, latentDimensions, maxConcurrent = 1, trust = 0.5, provenanceReceiptSha256 } = {}) {
    if (!id || !version || !Array.isArray(domains) || domains.length === 0 || !Number.isInteger(latentDimensions) || latentDimensions < 1 || !Number.isInteger(maxConcurrent) || maxConcurrent < 1 || !SHA.test(String(provenanceReceiptSha256 ?? ''))) throw new TypeError('Latent expert identity, domains, dimensions, capacity and provenance are required');
    const base = { schema: 'nolane.small-model.latent-memory-expert.v1', id: String(id), version: String(version), domains: [...new Set(domains.map(String))].sort(), latentDimensions, maxConcurrent, trust: bounded(trust, 'trust'), provenanceReceiptSha256: String(provenanceReceiptSha256) };
    const expert = deepFreeze({ ...base, expertSha256: canonicalSha256(base) });
    const history = this.#versions.get(expert.id) ?? [];
    this.#versions.set(expert.id, [...history, expert]);
    this.#active.set(expert.id, expert);
    return expert;
  }

  #activeCount(id) {
    return [...this.#leases.values()].filter((lease) => lease.expertId === id).length;
  }

  route({ domain = '*', latent, uncertainty = 0 } = {}) {
    const uncertaintyValue = bounded(uncertainty, 'uncertainty');
    if (uncertaintyValue >= this.#abstainUncertainty) return receipt('nolane.small-model.latent-memory-route.v1', { status: 'abstain', reason: 'uncertainty', expertId: null, leaseId: null, domain: String(domain), uncertainty: uncertaintyValue });
    if (!Array.isArray(latent) || latent.some((value) => !Number.isFinite(Number(value)))) throw new TypeError('Latent state must be a finite numeric array');
    const domainMatches = [...this.#active.values()].filter((expert) => expert.domains.includes(String(domain)) || expert.domains.includes('*'));
    if (domainMatches.length === 0) return receipt('nolane.small-model.latent-memory-route.v1', { status: 'abstain', reason: 'no-domain-expert', expertId: null, leaseId: null, domain: String(domain), uncertainty: uncertaintyValue });
    const dimensionMatches = domainMatches.filter((expert) => expert.latentDimensions === latent.length);
    if (dimensionMatches.length === 0) throw new Error(`Latent dimensions do not match any expert: ${latent.length}`);
    const available = dimensionMatches.filter((expert) => this.#activeCount(expert.id) < expert.maxConcurrent).sort((a, b) => b.trust - a.trust || a.id.localeCompare(b.id));
    if (available.length === 0) return receipt('nolane.small-model.latent-memory-route.v1', { status: 'abstain', reason: 'capacity', expertId: null, leaseId: null, domain: String(domain), uncertainty: uncertaintyValue });
    const expert = available[0];
    const leaseId = `latent-lease-${this.#nextLease++}`;
    const lease = { leaseId, expertId: expert.id, version: expert.version, latentSha256: canonicalSha256(latent.map(Number)), domain: String(domain) };
    this.#leases.set(leaseId, lease);
    return receipt('nolane.small-model.latent-memory-route.v1', { status: 'routed', ...lease, uncertainty: uncertaintyValue });
  }

  release(leaseId) {
    const existed = this.#leases.delete(String(leaseId));
    return deepFreeze({ schema: 'nolane.small-model.latent-memory-release.v1', leaseId: String(leaseId), released: existed });
  }

  recordOutcome({ id, version, success, verified, backwardTransfer = 0, receiptSha256 } = {}) {
    const expert = this.#active.get(String(id));
    if (!expert || expert.version !== String(version) || typeof success !== 'boolean' || verified !== true || !SHA.test(String(receiptSha256 ?? ''))) throw new Error('Verified latent expert outcome is required');
    const backward = Number(backwardTransfer);
    if (!Number.isFinite(backward)) throw new TypeError('backwardTransfer must be finite');
    if (backward < this.#minBackwardTransfer) {
      const history = this.#versions.get(expert.id) ?? [];
      if (history.length < 2) throw new Error('Latent expert negative transfer cannot roll back without a previous version');
      history.pop();
      this.#versions.set(expert.id, history);
      this.#active.set(expert.id, history.at(-1));
      for (const [leaseId, lease] of this.#leases) if (lease.expertId === expert.id) this.#leases.delete(leaseId);
      this.#rollbacks += 1;
      throw new Error('Latent expert negative transfer triggered rollback');
    }
    const target = success ? 1 : 0;
    const trust = Number((expert.trust + 0.2 * (target - expert.trust)).toFixed(6));
    const updated = deepFreeze({ ...expert, trust, outcomeReceiptSha256: String(receiptSha256) });
    const history = this.#versions.get(expert.id) ?? [];
    history[history.length - 1] = updated;
    this.#versions.set(expert.id, history);
    this.#active.set(expert.id, updated);
    return receipt('nolane.small-model.latent-memory-outcome.v1', { id: expert.id, version: expert.version, success, trust, backwardTransfer: backward, evidenceReceiptSha256: String(receiptSha256) });
  }

  activeExpert(id) { return this.#active.get(String(id)) ?? null; }

  snapshot() {
    return deepFreeze({ schema: 'nolane.small-model.latent-memory-router.v1', experts: this.#active.size, activeLeases: this.#leases.size, rollbacks: this.#rollbacks, hiddenChainOfThoughtStored: false });
  }
}
