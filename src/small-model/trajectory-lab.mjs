import { canonicalSha256, deepFreeze } from './shared.mjs';
import { validateTrajectoryEpisode } from './trajectory-schema.mjs';
export class TrajectoryLab {
  #episodes = new Map(); #policies = new Map(); #max;
  constructor({ maxEpisodes = 10_000 } = {}) { this.#max = Math.max(1, Number(maxEpisodes)); }
  record(input) {
    const episode = validateTrajectoryEpisode(input);
    if (this.#episodes.has(episode.id)) throw new Error(`Duplicate trajectory episode: ${episode.id}`);
    if (this.#episodes.size >= this.#max) throw new Error('Trajectory capacity exceeded');
    const base = { ...episode, recordedAt: new Date().toISOString() };
    const stored = deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
    this.#episodes.set(stored.id, stored); return stored;
  }
  list({ kind = null } = {}) { return Object.freeze([...this.#episodes.values()].filter((x) => !kind || x.kind === kind)); }
  promotePolicy({ id, version, episodeIds }) {
    if (!id || !version || !Array.isArray(episodeIds) || episodeIds.length === 0) throw new TypeError('Policy id, version and episodeIds are required');
    for (const episodeId of episodeIds) if (!this.#episodes.has(episodeId)) throw new Error(`Unknown trajectory episode: ${episodeId}`);
    const history = this.#policies.get(id) ?? [];
    const base = { id, version: String(version), episodeIds: [...episodeIds], previousVersion: history.at(-1)?.version ?? null };
    const policy = deepFreeze({ ...base, policySha256: canonicalSha256(base) });
    this.#policies.set(id, [...history, policy]); return policy;
  }
  rollbackPolicy(id) {
    const history = this.#policies.get(id) ?? [];
    if (history.length < 2) throw new Error(`No rollback version for policy: ${id}`);
    history.pop(); this.#policies.set(id, history); return history.at(-1);
  }
  snapshot() { return deepFreeze({ schema: 'nolane.small-model.trajectory-lab.v1', episodes: this.#episodes.size, curricula: Object.fromEntries([...new Set([...this.#episodes.values()].map((x) => x.kind))].map((kind) => [kind, this.list({ kind }).length])), policies: Object.fromEntries([...this.#policies].map(([id, history]) => [id, history.at(-1)?.version ?? null])) }); }
}
