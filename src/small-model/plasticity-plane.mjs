import { canonicalSha256, clone, deepFreeze, boundedNumber } from './shared.mjs';

export class PlasticityPlane {
  #learningRate;
  #maxNormDelta;
  #maxKlDivergence;
  #maxRegressionDelta;
  #consolidationThreshold;
  #minForwardTransfer;
  #minBackwardTransfer;
  #memories = new Map();
  #experiences = [];
  #slowMemories = new Map();
  #adapters = new Map();
  #activeAdapters = new Map();
  #rollbacks = 0;
  #adaptationPolicy = null;
  #latentMemoryRouter = null;

  constructor({
    learningRate = 0.5, maxNormDelta = 0.2, maxKlDivergence = 0.1, maxRegressionDelta = 0.02,
    consolidationThreshold = 3, minForwardTransfer = 0, minBackwardTransfer = -0.02,
  } = {}) {
    this.#learningRate = boundedNumber(learningRate, 'learningRate');
    this.#maxNormDelta = Number(maxNormDelta);
    this.#maxKlDivergence = Number(maxKlDivergence);
    this.#maxRegressionDelta = Number(maxRegressionDelta);
    this.#consolidationThreshold = Math.max(1, Number(consolidationThreshold));
    this.#minForwardTransfer = Number(minForwardTransfer);
    this.#minBackwardTransfer = Number(minBackwardTransfer);
  }


  attachAdaptationPolicy(learner) {
    if (!learner || typeof learner.select !== 'function' || typeof learner.recordOutcome !== 'function' || typeof learner.snapshot !== 'function') throw new TypeError('Adaptation policy learner is invalid');
    this.#adaptationPolicy = learner;
    return this.learningSnapshot();
  }

  attachLatentMemoryRouter(router) {
    if (!router || typeof router.route !== 'function' || typeof router.recordOutcome !== 'function' || typeof router.snapshot !== 'function') throw new TypeError('Latent memory router is invalid');
    this.#latentMemoryRouter = router;
    return this.learningSnapshot();
  }

  learningSnapshot() {
    const base = {
      schema: 'nolane.small-model.plasticity-learning-components.v1',
      adaptationPolicy: this.#adaptationPolicy?.snapshot() ?? null,
      latentMemoryRouter: this.#latentMemoryRouter?.snapshot() ?? null,
      stableCoreFrozen: true,
    };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }

  updateStableCore() {
    throw new Error('Stable core is frozen by default');
  }

  reinforceMemory({ id, reward, verified, provenance = [] } = {}) {
    if (!id || verified !== true) throw new Error('Memory reinforcement requires verified evidence');
    const r = boundedNumber(reward, 'memory reward');
    const current = this.#memories.get(id) ?? { id: String(id), qValue: 0, updates: 0, provenance: [] };
    const qValue = current.qValue + this.#learningRate * (r - current.qValue);
    const base = {
      id: current.id, qValue: Number(qValue.toFixed(6)), updates: current.updates + 1,
      provenance: [...new Set([...current.provenance, ...provenance.map(String)])].sort(),
    };
    const stored = deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
    this.#memories.set(stored.id, stored);
    return stored;
  }

  proposeAdapterUpdate({ adapterId, version, normDelta, klDivergence, regressionDelta, sourceEpisodes = [] } = {}) {
    if (!adapterId || !version) throw new TypeError('adapterId and version are required');
    const norm = Number(normDelta); const kl = Number(klDivergence); const regression = Number(regressionDelta);
    if (!Number.isFinite(norm) || norm < 0 || norm > this.#maxNormDelta) throw new Error('Adapter update exceeds norm budget');
    if (!Number.isFinite(kl) || kl < 0 || kl > this.#maxKlDivergence) throw new Error('Adapter update exceeds KL budget');
    if (!Number.isFinite(regression) || regression < 0 || regression > this.#maxRegressionDelta) throw new Error('Adapter update exceeds regression budget');
    const history = this.#adapters.get(adapterId) ?? [];
    const base = {
      schema: 'nolane.small-model.adapter-candidate.v1', adapterId: String(adapterId), version: String(version),
      status: 'shadow', metrics: { normDelta: norm, klDivergence: kl, regressionDelta: regression },
      sourceEpisodes: [...new Set(sourceEpisodes.map(String))].sort(), previousVersion: history.at(-1)?.version ?? null,
    };
    const candidate = deepFreeze({ ...base, adapterSha256: canonicalSha256(base) });
    this.#adapters.set(adapterId, [...history, candidate]);
    return candidate;
  }

  promoteAdapter({ adapterId, version, transfer } = {}) {
    const history = this.#adapters.get(adapterId) ?? [];
    const candidate = history.find((item) => item.version === String(version));
    if (!candidate) throw new Error(`Unknown adapter candidate: ${adapterId}@${version}`);
    const forward = Number(transfer?.forward); const backward = Number(transfer?.backward);
    if (!Number.isFinite(forward) || !Number.isFinite(backward) || forward < this.#minForwardTransfer || backward < this.#minBackwardTransfer) {
      this.#rollbacks += 1;
      throw new Error('Adapter transfer gate rejected negative transfer');
    }
    const promotedBase = { ...candidate, status: 'promoted', transfer: { forward, backward }, promotedAt: new Date().toISOString() };
    const promoted = deepFreeze({ ...promotedBase, promotionReceiptSha256: canonicalSha256(promotedBase) });
    const index = history.indexOf(candidate);
    history[index] = promoted;
    this.#adapters.set(adapterId, history);
    this.#activeAdapters.set(adapterId, promoted);
    return promoted;
  }

  activeAdapter(adapterId) {
    return this.#activeAdapters.get(adapterId) ?? null;
  }

  recordExperience({ key, verified, surprise = 0, forgettingRisk = 0, provenance = [] } = {}) {
    if (!key || verified !== true) throw new Error('Experience must be verified');
    const base = {
      id: `experience-${this.#experiences.length + 1}`, key: String(key), verified: true,
      surprise: boundedNumber(surprise, 'surprise'), forgettingRisk: boundedNumber(forgettingRisk, 'forgettingRisk'),
      provenance: [...new Set(provenance.map(String))].sort(),
    };
    const record = deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
    this.#experiences.push(record);
    return record;
  }

  replayQueue({ limit = 100 } = {}) {
    return deepFreeze([...this.#experiences]
      .sort((a, b) => (b.surprise + b.forgettingRisk) - (a.surprise + a.forgettingRisk) || a.key.localeCompare(b.key))
      .slice(0, Math.max(0, Number(limit))));
  }

  consolidate() {
    const groups = new Map();
    for (const experience of this.#experiences) {
      const group = groups.get(experience.key) ?? [];
      group.push(experience); groups.set(experience.key, group);
    }
    const promoted = [];
    for (const [key, items] of groups) {
      if (items.length < this.#consolidationThreshold || this.#slowMemories.has(key)) continue;
      const base = {
        key, occurrences: items.length,
        averageSurprise: Number((items.reduce((sum, item) => sum + item.surprise, 0) / items.length).toFixed(6)),
        averageForgettingRisk: Number((items.reduce((sum, item) => sum + item.forgettingRisk, 0) / items.length).toFixed(6)),
        sourceReceipts: items.map((item) => item.receiptSha256),
      };
      const memory = deepFreeze({ ...base, memorySha256: canonicalSha256(base) });
      this.#slowMemories.set(key, memory); promoted.push(memory);
    }
    const base = { schema: 'nolane.small-model.consolidation-receipt.v1', promoted: clone(promoted) };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }

  lineage() {
    const memories = [...this.#memories.values()].map((item) => ({ id: item.id, qValue: item.qValue, updates: item.updates, provenance: item.provenance, receiptSha256: item.receiptSha256 }));
    const adapters = [...this.#adapters.values()].flat().map((item) => ({ adapterId: item.adapterId, version: item.version, status: item.status, sourceEpisodes: item.sourceEpisodes, previousVersion: item.previousVersion, adapterSha256: item.adapterSha256 }));
    const base = { schema: 'nolane.small-model.plasticity-lineage.v1', memories, adapters };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }

  snapshot() {
    return deepFreeze({
      schema: 'nolane.small-model.plasticity-plane.v1', stableCoreFrozen: true, memories: this.#memories.size,
      fastExperiences: this.#experiences.length, slowMemories: this.#slowMemories.size,
      adapterCandidates: [...this.#adapters.values()].reduce((sum, history) => sum + history.length, 0),
      promotedAdapters: this.#activeAdapters.size, rollbacks: this.#rollbacks,
    });
  }
}
