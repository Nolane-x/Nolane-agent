import { boundedClone, signed, stringList, text } from './cognition-utils.mjs';

export class EpisodicBinder {
  constructor({ maxEpisodes = 500 } = {}) {
    this.maxEpisodes = Math.max(1, Math.min(10_000, Math.floor(Number(maxEpisodes) || 500)));
    this.episodes = new Map();
    this.order = [];
  }

  bind(input = {}) {
    const episodeId = text(input.episodeId, 'episodeId', 256);
    if (this.episodes.has(episodeId)) throw new TypeError(`duplicate episode id: ${episodeId}`);
    const base = {
      schema: 'forge.causal-episode.v1',
      episodeId,
      taskId: text(input.taskId, 'taskId', 256),
      contextBefore: text(input.contextBefore, 'contextBefore', 512),
      goal: text(input.goal, 'goal'),
      observations: stringList(input.observations, 'observations', { min: 1, maxItems: 128, itemMax: 256 }),
      hypothesesConsidered: stringList(input.hypothesesConsidered, 'hypothesesConsidered', { min: 1, maxItems: 16, itemMax: 256 }),
      actionId: text(input.actionId, 'actionId', 256),
      expectedEffect: boundedClone(input.expectedEffect ?? {}),
      actualEffect: boundedClone(input.actualEffect ?? {}),
      errorAttribution: boundedClone(input.errorAttribution ?? {}),
      rollbackPoint: text(input.rollbackPoint, 'rollbackPoint', 512),
      verification: boundedClone(input.verification ?? {}),
      lessonStatus: String(input.lessonStatus ?? 'unconsolidated').slice(0, 64),
      claims: { transcriptStored: false, causalBindingStored: true, replayable: true },
    };
    const episode = signed(base);
    this.episodes.set(episodeId, episode);
    this.order.push(episodeId);
    while (this.order.length > this.maxEpisodes) this.episodes.delete(this.order.shift());
    return episode;
  }

  get(episodeId) { return this.episodes.get(text(episodeId, 'episodeId', 256)) ?? null; }
  snapshot() {
    return signed({ schema: 'forge.episodic-binder-snapshot.v1', count: this.order.length, episodeIds: [...this.order], claims: { rawTranscriptsStored: false } });
  }
}
